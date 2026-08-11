import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('feed')
@UseGuards(JwtAuthGuard)
export class FeedController {
  constructor(private readonly prisma: PrismaService) {}

  private parseLimit(limit?: string) {
    const n = Number(limit ?? 20);
    return Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 20;
  }

  @Get('squad')
  async squad(
    @CurrentUser() user: { sub: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const dbUser = await this.prisma.users.findUnique({
      where: { cognito_sub: user.sub },
      select: { id: true },
    });

    if (!dbUser) return { posts: [], nextCursor: null };

    const following = await this.prisma.follows.findMany({
      where: { follower_id: dbUser.id },
      select: { following_id: true },
    });

    // Squad = posts from people you follow, plus your own posts.
    const authorIds = [...following.map((f) => f.following_id), dbUser.id];

    const take = this.parseLimit(limit);
    const createdBefore = cursor ? new Date(cursor) : undefined;

    const posts = await this.prisma.posts.findMany({
      where: {
        author_id: { in: authorIds },
        parent_post_id: null,
        ...(createdBefore ? { created_at: { lt: createdBefore } } : {}),
      },
      orderBy: { created_at: 'desc' },
      take,
      select: {
        id: true,
        content: true,
        created_at: true,
        author_id: true,
        users: { select: { username: true, display_name: true, profile_image_url: true } },
        post_teams: { select: { teams: { select: { id: true, name: true } } } },
        post_topics: { select: { topics: { select: { id: true, name: true } } } },
      },
    });

    const nextCursor = posts.length ? posts[posts.length - 1].created_at.toISOString() : null;
    return { posts, nextCursor };
  }

  @Get('12th-man')
  async twelfthMan(
    @CurrentUser() user: { sub: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const dbUser = await this.prisma.users.findUnique({
      where: { cognito_sub: user.sub },
      select: { id: true },
    });

    if (!dbUser) return { posts: [], nextCursor: null };

    const [teamLinks, topicLinks] = await Promise.all([
      this.prisma.user_teams.findMany({ where: { user_id: dbUser.id }, select: { team_id: true } }),
      this.prisma.user_topics.findMany({ where: { user_id: dbUser.id }, select: { topic_id: true } }),
    ]);

    const teamIds = teamLinks.map((t) => t.team_id);
    const topicIds = topicLinks.map((t) => t.topic_id);

    const take = this.parseLimit(limit);
    const createdBefore = cursor ? new Date(cursor) : undefined;

    const baseWhere: any = {
      parent_post_id: null,
      ...(createdBefore ? { created_at: { lt: createdBefore } } : {}),
    };

    let where: any = baseWhere;

    if (teamIds.length || topicIds.length) {
      where = {
        ...baseWhere,
        OR: [
          ...(teamIds.length ? [{ post_teams: { some: { team_id: { in: teamIds } } } }] : []),
          ...(topicIds.length ? [{ post_topics: { some: { topic_id: { in: topicIds } } } }] : []),
        ],
      };

      // If there are no matching posts, fall back to latest posts
      const matchCount = await this.prisma.posts.count({ where });
      if (matchCount === 0) {
        where = baseWhere;
      }
    }

    const posts = await this.prisma.posts.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take,
      select: {
        id: true,
        content: true,
        created_at: true,
        author_id: true,
        users: { select: { username: true, display_name: true, profile_image_url: true } },
        post_teams: { select: { teams: { select: { id: true, name: true } } } },
        post_topics: { select: { topics: { select: { id: true, name: true } } } },
      },
    });

    const nextCursor = posts.length ? posts[posts.length - 1].created_at.toISOString() : null;
    return { posts, nextCursor };
  }
}
