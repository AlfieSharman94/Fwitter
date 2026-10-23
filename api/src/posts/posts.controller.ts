import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreatePostDto } from './dto/create-post.dto';
import { VoteDto } from './dto/vote.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { feedPostSelect, toFeedPost } from './post-shape';
import { extractHashtags, extractMentions } from './content-entities';
import { NotificationsService } from '../notifications/notifications.service';
import { ModerationService } from '../moderation/moderation.service';
import { Throttle } from '@nestjs/throttler';
import { MediaService } from '../media/media.service';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly moderation: ModerationService,
    private readonly media: MediaService,
  ) {}

  private parseLimit(limit?: string) {
    const n = Number(limit ?? 20);
    return Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 20;
  }

  private async requireViewer(sub: string) {
    const dbUser = await this.prisma.users.findUnique({
      where: { cognito_sub: sub },
      select: { id: true },
    });
    if (!dbUser) throw new BadRequestException('profile_not_found');
    return dbUser;
  }

  // Likes, bookmarks, reposts and votes always target the original post: if `id` is a
  // plain repost row, resolve through to the post it reposts. Hidden posts and posts
  // across a block can't be interacted with.
  private async requireOriginal(id: string, viewerId: string) {
    const post = await this.prisma.posts.findUnique({
      where: { id },
      select: { id: true, author_id: true, repost_of_id: true, hidden_at: true },
    });
    if (!post) throw new NotFoundException('post_not_found');

    const original = post.repost_of_id
      ? await this.prisma.posts.findUnique({
          where: { id: post.repost_of_id },
          select: { id: true, author_id: true, hidden_at: true },
        })
      : post;
    if (!original) throw new NotFoundException('post_not_found');

    await this.moderation.assertVisible(viewerId, original);
    return { id: original.id, author_id: original.author_id };
  }

  // Same rule as post-shape.ts: counts are only revealed to the author.
  private async likeState(post: { id: string; author_id: string }, viewerId: string) {
    const [liked, like_count] = await Promise.all([
      this.prisma.post_likes.findUnique({
        where: { post_id_user_id: { post_id: post.id, user_id: viewerId } },
        select: { user_id: true },
      }),
      post.author_id === viewerId
        ? this.prisma.post_likes.count({ where: { post_id: post.id } })
        : Promise.resolve(null),
    ]);
    return { liked: !!liked, like_count };
  }

  private async repostState(post: { id: string; author_id: string }, viewerId: string) {
    const [mine, repost_count] = await Promise.all([
      this.prisma.posts.findFirst({
        where: { author_id: viewerId, repost_of_id: post.id },
        select: { id: true },
      }),
      post.author_id === viewerId
        ? this.prisma.posts.count({ where: { repost_of_id: post.id } })
        : Promise.resolve(null),
    ]);
    return { reposted: !!mine, repost_count };
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async create(@CurrentUser() user: { sub: string }, @Body() dto: CreatePostDto) {
    const dbUser = await this.requireViewer(user.sub);

    const content = dto.content.trim();
    const mediaIds = Array.from(new Set(dto.mediaIds ?? []));
    // Text is optional when there are pictures.
    if (!content && mediaIds.length === 0) throw new BadRequestException('content_required');
    await this.moderation.assertContentAllowed(content);

    let parent: { id: string; author_id: string; hidden_at: Date | null } | null = null;
    if (dto.parentPostId) {
      parent = await this.prisma.posts.findUnique({
        where: { id: dto.parentPostId },
        select: { id: true, author_id: true, hidden_at: true },
      });
      if (!parent) throw new BadRequestException('parent_post_not_found');
      await this.moderation.assertVisible(dbUser.id, parent);
      await this.moderation.assertCanInteract(dbUser.id, parent.author_id);
    }

    let quotedTarget: { id: string; author_id: string } | null = null;
    if (dto.quotedPostId) {
      const quoted = await this.prisma.posts.findUnique({
        where: { id: dto.quotedPostId },
        select: { id: true, author_id: true, repost_of_id: true },
      });
      if (!quoted) throw new BadRequestException('quoted_post_not_found');
      // Quoting a plain repost quotes what it reposted.
      quotedTarget = quoted.repost_of_id
        ? await this.prisma.posts.findUnique({
            where: { id: quoted.repost_of_id },
            select: { id: true, author_id: true },
          })
        : { id: quoted.id, author_id: quoted.author_id };
      if (!quotedTarget) throw new BadRequestException('quoted_post_not_found');
      await this.moderation.assertCanInteract(dbUser.id, quotedTarget.author_id);
    }
    const quotedPostId = quotedTarget?.id ?? null;

    if (dto.matchId) {
      const match = await this.prisma.matches.findUnique({ where: { id: dto.matchId }, select: { id: true } });
      if (!match) throw new BadRequestException('match_not_found');
    }

    const teamIds = Array.from(new Set(dto.teamIds ?? []));
    const topicIds = Array.from(new Set(dto.topicIds ?? []));

    // Top-level posts (quotes included) must be scoped to football content: at least
    // one team or topic. Replies inherit scope from their parent thread, so they are exempt.
    if (!dto.parentPostId && teamIds.length === 0 && topicIds.length === 0) {
      throw new BadRequestException('team_or_topic_required');
    }

    // Validate referenced ids exist (only if provided)
    if (teamIds.length) {
      const found = await this.prisma.teams.count({ where: { id: { in: teamIds } } });
      if (found !== teamIds.length) throw new BadRequestException('one_or_more_teams_not_found');
    }
    if (topicIds.length) {
      const found = await this.prisma.topics.count({ where: { id: { in: topicIds } } });
      if (found !== topicIds.length) throw new BadRequestException('one_or_more_topics_not_found');
    }

    // @mentions that match a real username (case-insensitive) are stored; the rest stay plain text.
    const mentionNames = extractMentions(content);
    const mentioned = mentionNames.length
      ? await this.prisma.users.findMany({
          where: { OR: mentionNames.map((name) => ({ username: { equals: name, mode: 'insensitive' as const } })) },
          select: { id: true },
        })
      : [];
    const hashtags = extractHashtags(content);

    // Poll options are validated for shape by the DTO; content rules live here.
    let pollOptions: string[] | null = null;
    if (dto.poll) {
      const options = dto.poll.options.map((o) => o.trim());
      if (options.some((o) => !o)) throw new BadRequestException('poll_option_empty');
      if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
        throw new BadRequestException('poll_options_must_differ');
      }
      pollOptions = options;
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const post = await tx.posts.create({
        data: {
          author_id: dbUser.id,
          content,
          parent_post_id: dto.parentPostId ?? null,
          quoted_post_id: quotedPostId,
          match_id: dto.matchId ?? null,
        },
        select: { id: true },
      });

      if (teamIds.length) {
        await tx.post_teams.createMany({
          data: teamIds.map((teamId) => ({ post_id: post.id, team_id: teamId })),
        });
      }

      if (topicIds.length) {
        await tx.post_topics.createMany({
          data: topicIds.map((topicId) => ({ post_id: post.id, topic_id: topicId })),
        });
      }

      if (mentioned.length) {
        await tx.post_mentions.createMany({
          data: mentioned.map((u) => ({ post_id: post.id, user_id: u.id })),
        });
      }

      if (hashtags.length) {
        // Tags are shared rows: create any new ones, then link all of them.
        await tx.hashtags.createMany({ data: hashtags.map((tag) => ({ tag })), skipDuplicates: true });
        const rows = await tx.hashtags.findMany({ where: { tag: { in: hashtags } }, select: { id: true } });
        await tx.post_hashtags.createMany({
          data: rows.map((h) => ({ post_id: post.id, hashtag_id: h.id })),
        });
      }

      if (mediaIds.length) {
        await this.media.attachToPost(tx, dbUser.id, post.id, mediaIds);
      }

      if (pollOptions && dto.poll) {
        await tx.polls.create({
          data: {
            post_id: post.id,
            ends_at: new Date(Date.now() + dto.poll.durationHours * 60 * 60 * 1000),
            poll_options: { create: pollOptions.map((text, position) => ({ text, position })) },
          },
        });
      }

      // Engagement counters on the post being replied to / quoted.
      if (parent) {
        await tx.posts.update({ where: { id: parent.id }, data: { reply_count: { increment: 1 } } });
      }
      if (quotedTarget) {
        await tx.posts.update({ where: { id: quotedTarget.id }, data: { quote_count: { increment: 1 } } });
      }

      // Re-read with the tags attached so the response matches what the feeds return.
      return tx.posts.findUniqueOrThrow({ where: { id: post.id }, select: feedPostSelect(dbUser.id) });
    });

    // Notifications are fire-and-forget. Someone replied to or quoted gets one
    // notification even if the text also @mentions them.
    const alreadyTold = new Set<string>();
    if (parent) {
      alreadyTold.add(parent.author_id);
      void this.notifications.notify({ recipientId: parent.author_id, actorId: dbUser.id, type: 'REPLY', postId: created.id });
    }
    if (quotedTarget) {
      alreadyTold.add(quotedTarget.author_id);
      void this.notifications.notify({ recipientId: quotedTarget.author_id, actorId: dbUser.id, type: 'QUOTE', postId: created.id });
    }
    for (const u of mentioned) {
      if (alreadyTold.has(u.id)) continue;
      void this.notifications.notify({ recipientId: u.id, actorId: dbUser.id, type: 'MENTION', postId: created.id });
    }

    return { ok: true, post: toFeedPost(created, dbUser.id) };
  }

  @Get(':id')
  async getOne(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    const viewer = await this.requireViewer(user.sub);

    const post = await this.prisma.posts.findUnique({
      where: { id },
      select: {
        ...feedPostSelect(viewer.id),
        // `posts` is the self-relation to the parent, used for "Replying to @name".
        posts: { select: { id: true, users: { select: { username: true } } } },
      },
    });

    if (!post) throw new NotFoundException('post_not_found');
    await this.moderation.assertVisible(viewer.id, post);

    const { posts: parent, ...rest } = post;
    return {
      post: toFeedPost(rest, viewer.id),
      parent: parent ? { id: parent.id, username: parent.users.username } : null,
    };
  }

  @Get(':id/replies')
  async replies(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const viewer = await this.requireViewer(user.sub);
    const take = this.parseLimit(limit);
    const createdBefore = cursor ? new Date(cursor) : undefined;

    const replies = await this.prisma.posts.findMany({
      where: {
        parent_post_id: id,
        ...(createdBefore ? { created_at: { lt: createdBefore } } : {}),
        ...(await this.moderation.visibility(viewer.id)),
      },
      orderBy: { created_at: 'desc' },
      take,
      select: feedPostSelect(viewer.id),
    });

    const nextCursor = replies.length ? replies[replies.length - 1].created_at.toISOString() : null;
    return { replies: replies.map((r) => toFeedPost(r, viewer.id)), nextCursor };
  }

  @Post(':id/like')
  async like(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    const viewer = await this.requireViewer(user.sub);
    const post = await this.requireOriginal(id, viewer.id);
    // The counter only moves when a row was actually written (double-tap safe).
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.post_likes.createMany({
        data: [{ post_id: post.id, user_id: viewer.id }],
        skipDuplicates: true, // liking twice is a no-op, not an error
      });
      if (count > 0) await tx.posts.update({ where: { id: post.id }, data: { like_count: { increment: 1 } } });
    });
    void this.notifications.notify({ recipientId: post.author_id, actorId: viewer.id, type: 'LIKE', postId: post.id });
    return this.likeState(post, viewer.id);
  }

  @Delete(':id/like')
  async unlike(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    const viewer = await this.requireViewer(user.sub);
    const post = await this.requireOriginal(id, viewer.id);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.post_likes.deleteMany({ where: { post_id: post.id, user_id: viewer.id } });
      if (count > 0) await tx.posts.update({ where: { id: post.id }, data: { like_count: { decrement: 1 } } });
    });
    void this.notifications.remove({ recipientId: post.author_id, actorId: viewer.id, type: 'LIKE', postId: post.id });
    return this.likeState(post, viewer.id);
  }

  @Post(':id/bookmark')
  async bookmark(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    const viewer = await this.requireViewer(user.sub);
    const post = await this.requireOriginal(id, viewer.id);
    await this.prisma.bookmarks.createMany({
      data: [{ user_id: viewer.id, post_id: post.id }],
      skipDuplicates: true,
    });
    return { bookmarked: true };
  }

  @Delete(':id/bookmark')
  async unbookmark(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    const viewer = await this.requireViewer(user.sub);
    const post = await this.requireOriginal(id, viewer.id);
    await this.prisma.bookmarks.deleteMany({ where: { user_id: viewer.id, post_id: post.id } });
    return { bookmarked: false };
  }

  @Post(':id/vote')
  async vote(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: VoteDto) {
    const viewer = await this.requireViewer(user.sub);
    const post = await this.requireOriginal(id, viewer.id);

    const poll = await this.prisma.polls.findUnique({
      where: { post_id: post.id },
      select: { ends_at: true, poll_options: { select: { id: true } } },
    });
    if (!poll) throw new NotFoundException('poll_not_found');
    if (poll.ends_at.getTime() <= Date.now()) throw new BadRequestException('poll_ended');
    if (!poll.poll_options.some((o) => o.id === dto.optionId)) throw new BadRequestException('invalid_option');

    try {
      await this.prisma.poll_votes.create({
        data: { poll_id: post.id, user_id: viewer.id, option_id: dto.optionId },
      });
    } catch (e: any) {
      // (poll_id, user_id) is the primary key: a second vote is rejected, not changed.
      if (e?.code === 'P2002') throw new ConflictException('already_voted');
      throw e;
    }

    const fresh = await this.prisma.posts.findUniqueOrThrow({
      where: { id: post.id },
      select: feedPostSelect(viewer.id),
    });
    return { poll: toFeedPost(fresh, viewer.id).poll };
  }

  @Post(':id/repost')
  async repost(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    const viewer = await this.requireViewer(user.sub);
    const post = await this.requireOriginal(id, viewer.id);
    // A plain repost is its own posts row with no content. (author_id, repost_of_id)
    // is unique, so reposting twice is a no-op.
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.posts.createMany({
        data: [{ author_id: viewer.id, content: '', repost_of_id: post.id }],
        skipDuplicates: true,
      });
      if (count > 0) await tx.posts.update({ where: { id: post.id }, data: { repost_count: { increment: 1 } } });
    });
    void this.notifications.notify({ recipientId: post.author_id, actorId: viewer.id, type: 'REPOST', postId: post.id });
    return this.repostState(post, viewer.id);
  }

  @Delete(':id/repost')
  async unrepost(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    const viewer = await this.requireViewer(user.sub);
    const post = await this.requireOriginal(id, viewer.id);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.posts.deleteMany({ where: { author_id: viewer.id, repost_of_id: post.id } });
      if (count > 0) await tx.posts.update({ where: { id: post.id }, data: { repost_count: { decrement: 1 } } });
    });
    void this.notifications.remove({ recipientId: post.author_id, actorId: viewer.id, type: 'REPOST', postId: post.id });
    return this.repostState(post, viewer.id);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    const dbUser = await this.requireViewer(user.sub);

    const post = await this.prisma.posts.findUnique({
      where: { id },
      select: {
        author_id: true,
        parent_post_id: true,
        quoted_post_id: true,
        repost_of_id: true,
        repost_of: { select: { author_id: true } },
        media: { select: { key: true } },
      },
    });
    if (!post) throw new NotFoundException('post_not_found');
    if (post.author_id !== dbUser.id) throw new ForbiddenException('not_your_post');

    // Hard delete. Tags, likes, bookmarks, replies, plain reposts of this post and
    // notifications about it cascade via FK onDelete; quote posts keep their own
    // content and lose the embed (SetNull). Counters on the posts this one pointed
    // at come down in the same transaction.
    await this.prisma.$transaction(async (tx) => {
      await tx.posts.delete({ where: { id } });
      if (post.parent_post_id) {
        await tx.posts.updateMany({
          where: { id: post.parent_post_id, reply_count: { gt: 0 } },
          data: { reply_count: { decrement: 1 } },
        });
      }
      if (post.quoted_post_id) {
        await tx.posts.updateMany({
          where: { id: post.quoted_post_id, quote_count: { gt: 0 } },
          data: { quote_count: { decrement: 1 } },
        });
      }
      if (post.repost_of_id) {
        await tx.posts.updateMany({
          where: { id: post.repost_of_id, repost_count: { gt: 0 } },
          data: { repost_count: { decrement: 1 } },
        });
      }
    });

    // The media rows cascade with the post; the objects in the bucket are removed here.
    void this.media.deleteObjects(post.media.map((m) => m.key));

    // Deleting a repost row from your profile is an undo: drop the author's notification.
    if (post.repost_of_id && post.repost_of) {
      void this.notifications.remove({
        recipientId: post.repost_of.author_id,
        actorId: dbUser.id,
        type: 'REPOST',
        postId: post.repost_of_id,
      });
    }
    return { ok: true };
  }
}
