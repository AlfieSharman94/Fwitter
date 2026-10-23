import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { feedPostSelect, toFeedPost } from '../posts/post-shape';
import { ModerationService } from '../moderation/moderation.service';

@Controller('hashtags')
@UseGuards(JwtAuthGuard)
export class HashtagsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
  ) {}

  // Most-used tags over the last 24 hours (last 7 days if the day is quiet).
  @Get('trending')
  async trending() {
    const top = async (since: Date) => {
      const groups = await this.prisma.post_hashtags.groupBy({
        by: ['hashtag_id'],
        where: { posts: { created_at: { gt: since } } },
        _count: { post_id: true },
        orderBy: { _count: { post_id: 'desc' } },
        take: 10,
      });
      if (!groups.length) return [];
      const tags = await this.prisma.hashtags.findMany({
        where: { id: { in: groups.map((g) => g.hashtag_id) } },
        select: { id: true, tag: true },
      });
      const byId = new Map(tags.map((t) => [t.id, t.tag]));
      return groups.map((g) => ({ tag: byId.get(g.hashtag_id)!, posts: g._count.post_id }));
    };

    const day = 24 * 60 * 60 * 1000;
    let trending = await top(new Date(Date.now() - day));
    let window: 'day' | 'week' = 'day';
    if (!trending.length) {
      trending = await top(new Date(Date.now() - 7 * day));
      window = 'week';
    }
    return { trending, window };
  }

  // Every post (top-level or reply) carrying the tag, newest first.
  @Get(':tag/posts')
  async posts(
    @CurrentUser() user: { sub: string },
    @Param('tag') rawTag: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const tag = rawTag.toLowerCase();
    if (!/^[a-z][a-z0-9_]{0,49}$/.test(tag)) throw new BadRequestException('invalid_hashtag');

    const viewer = await this.prisma.users.findUnique({
      where: { cognito_sub: user.sub },
      select: { id: true },
    });
    if (!viewer) throw new BadRequestException('profile_not_found');

    const n = Number(limit ?? 20);
    const take = Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 20;
    const createdBefore = cursor ? new Date(cursor) : undefined;

    const posts = await this.prisma.posts.findMany({
      where: {
        post_hashtags: { some: { hashtags: { tag } } },
        ...(createdBefore ? { created_at: { lt: createdBefore } } : {}),
        ...(await this.moderation.visibility(viewer.id)),
      },
      orderBy: { created_at: 'desc' },
      take,
      select: feedPostSelect(viewer.id),
    });

    const nextCursor = posts.length ? posts[posts.length - 1].created_at.toISOString() : null;
    return { tag, posts: posts.map((p) => toFeedPost(p, viewer.id)), nextCursor };
  }
}
