import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { feedPostSelect, toFeedPost } from '../posts/post-shape';

@Controller('hashtags')
@UseGuards(JwtAuthGuard)
export class HashtagsController {
  constructor(private readonly prisma: PrismaService) {}

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
      },
      orderBy: { created_at: 'desc' },
      take,
      select: feedPostSelect(viewer.id),
    });

    const nextCursor = posts.length ? posts[posts.length - 1].created_at.toISOString() : null;
    return { tag, posts: posts.map((p) => toFeedPost(p, viewer.id)), nextCursor };
  }
}
