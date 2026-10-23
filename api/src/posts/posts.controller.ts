import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreatePostDto } from './dto/create-post.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { feedPostSelect, toFeedPost } from './post-shape';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private readonly prisma: PrismaService) {}

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

  // Likes, bookmarks and reposts always target the original post: if `id` is a
  // plain repost row, resolve through to the post it reposts.
  private async requireOriginal(id: string) {
    const post = await this.prisma.posts.findUnique({
      where: { id },
      select: { id: true, author_id: true, repost_of_id: true },
    });
    if (!post) throw new NotFoundException('post_not_found');
    if (!post.repost_of_id) return { id: post.id, author_id: post.author_id };

    const original = await this.prisma.posts.findUnique({
      where: { id: post.repost_of_id },
      select: { id: true, author_id: true },
    });
    if (!original) throw new NotFoundException('post_not_found');
    return original;
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
  async create(@CurrentUser() user: { sub: string }, @Body() dto: CreatePostDto) {
    const dbUser = await this.requireViewer(user.sub);

    const content = dto.content.trim();
    if (!content) throw new BadRequestException('content_required');

    if (dto.parentPostId) {
      const parent = await this.prisma.posts.findUnique({
        where: { id: dto.parentPostId },
        select: { id: true },
      });
      if (!parent) throw new BadRequestException('parent_post_not_found');
    }

    let quotedPostId: string | null = null;
    if (dto.quotedPostId) {
      const quoted = await this.prisma.posts.findUnique({
        where: { id: dto.quotedPostId },
        select: { id: true, repost_of_id: true },
      });
      if (!quoted) throw new BadRequestException('quoted_post_not_found');
      // Quoting a plain repost quotes what it reposted.
      quotedPostId = quoted.repost_of_id ?? quoted.id;
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

    const created = await this.prisma.$transaction(async (tx) => {
      const post = await tx.posts.create({
        data: {
          author_id: dbUser.id,
          content,
          parent_post_id: dto.parentPostId ?? null,
          quoted_post_id: quotedPostId,
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

      // Re-read with the tags attached so the response matches what the feeds return.
      return tx.posts.findUniqueOrThrow({ where: { id: post.id }, select: feedPostSelect(dbUser.id) });
    });

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
    const post = await this.requireOriginal(id);
    await this.prisma.post_likes.createMany({
      data: [{ post_id: post.id, user_id: viewer.id }],
      skipDuplicates: true, // liking twice is a no-op, not an error
    });
    return this.likeState(post, viewer.id);
  }

  @Delete(':id/like')
  async unlike(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    const viewer = await this.requireViewer(user.sub);
    const post = await this.requireOriginal(id);
    await this.prisma.post_likes.deleteMany({ where: { post_id: post.id, user_id: viewer.id } });
    return this.likeState(post, viewer.id);
  }

  @Post(':id/bookmark')
  async bookmark(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    const viewer = await this.requireViewer(user.sub);
    const post = await this.requireOriginal(id);
    await this.prisma.bookmarks.createMany({
      data: [{ user_id: viewer.id, post_id: post.id }],
      skipDuplicates: true,
    });
    return { bookmarked: true };
  }

  @Delete(':id/bookmark')
  async unbookmark(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    const viewer = await this.requireViewer(user.sub);
    const post = await this.requireOriginal(id);
    await this.prisma.bookmarks.deleteMany({ where: { user_id: viewer.id, post_id: post.id } });
    return { bookmarked: false };
  }

  @Post(':id/repost')
  async repost(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    const viewer = await this.requireViewer(user.sub);
    const post = await this.requireOriginal(id);
    // A plain repost is its own posts row with no content. (author_id, repost_of_id)
    // is unique, so reposting twice is a no-op.
    await this.prisma.posts.createMany({
      data: [{ author_id: viewer.id, content: '', repost_of_id: post.id }],
      skipDuplicates: true,
    });
    return this.repostState(post, viewer.id);
  }

  @Delete(':id/repost')
  async unrepost(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    const viewer = await this.requireViewer(user.sub);
    const post = await this.requireOriginal(id);
    await this.prisma.posts.deleteMany({ where: { author_id: viewer.id, repost_of_id: post.id } });
    return this.repostState(post, viewer.id);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    const dbUser = await this.requireViewer(user.sub);

    const post = await this.prisma.posts.findUnique({
      where: { id },
      select: { author_id: true },
    });
    if (!post) throw new NotFoundException('post_not_found');
    if (post.author_id !== dbUser.id) throw new ForbiddenException('not_your_post');

    // Hard delete. Tags, likes, bookmarks, replies and plain reposts of this post cascade
    // via FK onDelete; quote posts keep their own content and lose the embed (SetNull).
    await this.prisma.posts.delete({ where: { id } });
    return { ok: true };
  }
}
