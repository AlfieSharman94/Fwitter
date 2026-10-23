import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { feedPostSelect, toFeedPost } from '../posts/post-shape';
import { Candidate, decodeCursor, rankPage } from './ranking';
import { ModerationService } from '../moderation/moderation.service';

// "For you" scores posts from the last week. If the community has been quiet the
// window widens to a month, then to everything, rather than showing nothing.
const CANDIDATE_WINDOWS_DAYS = [7, 30, 3650];
const MAX_CANDIDATES = 400;

type ViewerContext = {
  id: string;
  followingIds: string[];
  teamIds: string[];
  primaryTeamId: string | null;
  topicIds: string[];
};

const candidateSelect = {
  id: true,
  author_id: true,
  created_at: true,
  like_count: true,
  reply_count: true,
  repost_count: true,
  quote_count: true,
  post_teams: { select: { team_id: true } },
} as const;

type CandidateRow = Prisma.postsGetPayload<{ select: typeof candidateSelect }>;

@Controller('feed')
@UseGuards(JwtAuthGuard)
export class FeedController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
  ) {}

  private parseLimit(limit?: string) {
    const n = Number(limit ?? 20);
    return Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 20;
  }

  private async viewerContext(sub: string): Promise<ViewerContext | null> {
    const dbUser = await this.prisma.users.findUnique({
      where: { cognito_sub: sub },
      select: { id: true },
    });
    if (!dbUser) return null;

    const [following, teamLinks, topicLinks] = await Promise.all([
      this.prisma.follows.findMany({ where: { follower_id: dbUser.id }, select: { following_id: true } }),
      this.prisma.user_teams.findMany({ where: { user_id: dbUser.id }, select: { team_id: true, is_primary: true } }),
      this.prisma.user_topics.findMany({ where: { user_id: dbUser.id }, select: { topic_id: true } }),
    ]);

    return {
      id: dbUser.id,
      followingIds: following.map((f) => f.following_id),
      teamIds: teamLinks.map((t) => t.team_id),
      primaryTeamId: teamLinks.find((t) => t.is_primary)?.team_id ?? null,
      topicIds: topicLinks.map((t) => t.topic_id),
    };
  }

  // What makes a post "yours": people you follow, your teams, your topics.
  // Null when the account has none of those yet.
  private interestWhere(ctx: ViewerContext) {
    const or: object[] = [];
    if (ctx.followingIds.length) or.push({ author_id: { in: ctx.followingIds } });
    if (ctx.teamIds.length) or.push({ post_teams: { some: { team_id: { in: ctx.teamIds } } } });
    if (ctx.topicIds.length) or.push({ post_topics: { some: { topic_id: { in: ctx.topicIds } } } });
    return or.length ? { OR: or } : null;
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
        ...(await this.moderation.visibility(dbUser.id)),
      },
      orderBy: { created_at: 'desc' },
      take,
      select: feedPostSelect(dbUser.id),
    });

    const nextCursor = posts.length ? posts[posts.length - 1].created_at.toISOString() : null;
    return { posts: posts.map((p) => toFeedPost(p, dbUser.id)), nextCursor };
  }

  // 12th Man: `sort=latest` is chronological; anything else is the ranked "For you".
  @Get('12th-man')
  async twelfthMan(
    @CurrentUser() user: { sub: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
  ) {
    const ctx = await this.viewerContext(user.sub);
    if (!ctx) return { posts: [], nextCursor: null };
    const take = this.parseLimit(limit);
    return sort === 'latest' ? this.latest(ctx, take, cursor) : this.forYou(ctx, take, cursor);
  }

  private async latest(ctx: ViewerContext, take: number, cursor?: string) {
    const createdBefore = cursor ? new Date(cursor) : undefined;
    if (createdBefore && Number.isNaN(createdBefore.getTime())) throw new BadRequestException('invalid_cursor');

    // No follows, teams or topics yet: show everything rather than nothing.
    const interest = this.interestWhere(ctx);

    const posts = await this.prisma.posts.findMany({
      where: {
        parent_post_id: null,
        repost_of_id: null,
        ...(interest ?? {}),
        ...(createdBefore ? { created_at: { lt: createdBefore } } : {}),
        ...(await this.moderation.visibility(ctx.id)),
      },
      orderBy: { created_at: 'desc' },
      take,
      select: feedPostSelect(ctx.id),
    });

    const nextCursor = posts.length === take ? posts[posts.length - 1].created_at.toISOString() : null;
    return { posts: posts.map((p) => toFeedPost(p, ctx.id)), nextCursor };
  }

  // Posts worth scoring: other people's top-level posts in the window, preferring
  // ones that match your interests and topping up with everything else when
  // those are thin (new account, few follows).
  private async candidates(
    ctx: ViewerContext,
    interest: ReturnType<FeedController['interestWhere']>,
    asOf: Date,
    windowDays: number,
    take: number,
  ): Promise<CandidateRow[]> {
    const since = new Date(asOf.getTime() - windowDays * 86_400_000);
    // Own posts are left to Squad; For you is for finding other people's. Blocked
    // authors and hidden posts never become candidates.
    const base = {
      parent_post_id: null,
      repost_of_id: null,
      author_id: { not: ctx.id },
      created_at: { gt: since, lte: asOf },
      ...(await this.moderation.visibility(ctx.id)),
    };

    const rows = await this.prisma.posts.findMany({
      where: { ...base, ...(interest ?? {}) },
      orderBy: { created_at: 'desc' },
      take: MAX_CANDIDATES,
      select: candidateSelect,
    });
    if (rows.length >= take * 2) return rows;

    const extra = await this.prisma.posts.findMany({
      where: { ...base, id: { notIn: rows.map((r) => r.id) } },
      orderBy: { created_at: 'desc' },
      take: MAX_CANDIDATES - rows.length,
      select: candidateSelect,
    });
    return [...rows, ...extra];
  }

  private async forYou(ctx: ViewerContext, take: number, cursor?: string) {
    const rankCursor = decodeCursor(cursor);
    if (cursor && !rankCursor) throw new BadRequestException('invalid_cursor');

    // Later pages reuse the first page's clock so scores and the candidate set are stable.
    const asOf = rankCursor ? new Date(rankCursor.asOf) : new Date();
    const interest = this.interestWhere(ctx);

    let rows: CandidateRow[] = [];
    for (const days of CANDIDATE_WINDOWS_DAYS) {
      rows = await this.candidates(ctx, interest, asOf, days, take);
      if (rows.length >= take * 2) break;
    }

    const following = new Set(ctx.followingIds);
    const candidates: Candidate[] = rows.map((r) => ({
      id: r.id,
      author_id: r.author_id,
      created_at: r.created_at,
      like_count: r.like_count,
      reply_count: r.reply_count,
      repost_count: r.repost_count,
      quote_count: r.quote_count,
      followed: following.has(r.author_id),
      primaryTeam: !!ctx.primaryTeamId && r.post_teams.some((t) => t.team_id === ctx.primaryTeamId),
    }));

    const { ids, nextCursor } = rankPage(candidates, asOf, rankCursor, take);
    if (!ids.length) return { posts: [], nextCursor: null };

    const full = await this.prisma.posts.findMany({
      where: { id: { in: ids } },
      select: feedPostSelect(ctx.id),
    });
    const byId = new Map(full.map((p) => [p.id, p]));
    const posts = ids
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => toFeedPost(p, ctx.id));

    return { posts, nextCursor };
  }
}
