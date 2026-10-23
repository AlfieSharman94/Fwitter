import { BadRequestException, Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { feedPostSelect, toFeedPost } from '../posts/post-shape';
import { FixturesSyncService } from './fixtures-sync.service';
import { ModerationService } from '../moderation/moderation.service';

const DAY_MS = 86_400_000;

const matchSelect = {
  id: true,
  competition: true,
  competition_name: true,
  home_name: true,
  away_name: true,
  home_crest: true,
  away_crest: true,
  kickoff_at: true,
  status: true,
  minute: true,
  home_score: true,
  away_score: true,
  home_team: { select: { id: true, name: true } },
  away_team: { select: { id: true, name: true } },
  _count: { select: { posts: true } },
} as const;

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: FixturesSyncService,
    private readonly moderation: ModerationService,
  ) {}

  private async requireViewer(sub: string) {
    const dbUser = await this.prisma.users.findUnique({
      where: { cognito_sub: sub },
      select: { id: true },
    });
    if (!dbUser) throw new BadRequestException('profile_not_found');
    return dbUser;
  }

  private shape<T extends { _count: { posts: number } }>(m: T) {
    const { _count, ...rest } = m;
    return { ...rest, post_count: _count.posts };
  }

  // Yesterday's results through the next week. scope=mine keeps matches involving
  // the viewer's teams; anything else returns everything in the window.
  @Get()
  async list(@CurrentUser() user: { sub: string }, @Query('scope') scope?: string) {
    const viewer = await this.requireViewer(user.sub);
    const now = Date.now();
    const window = { kickoff_at: { gte: new Date(now - 1.5 * DAY_MS), lte: new Date(now + 8 * DAY_MS) } };

    let where: Record<string, unknown> = window;
    if (scope === 'mine') {
      const teamIds = (
        await this.prisma.user_teams.findMany({ where: { user_id: viewer.id }, select: { team_id: true } })
      ).map((t) => t.team_id);
      where = {
        ...window,
        OR: [{ home_team_id: { in: teamIds } }, { away_team_id: { in: teamIds } }],
      };
    }

    const rows = await this.prisma.matches.findMany({
      where,
      orderBy: { kickoff_at: 'asc' },
      select: matchSelect,
    });

    const matches = rows.map((m) => this.shape(m));
    const live = matches.filter((m) => ['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'].includes(m.status)).length;
    return { matches, live };
  }

  // Manual refresh for testing; the service throttles it to once every 45 seconds.
  @Post('sync')
  async syncNow() {
    return this.sync.sync('manual');
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const match = await this.prisma.matches.findUnique({ where: { id }, select: matchSelect });
    if (!match) throw new NotFoundException('match_not_found');
    return { match: this.shape(match) };
  }

  // The match thread: top-level posts made from this hub, newest first.
  @Get(':id/posts')
  async posts(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const viewer = await this.requireViewer(user.sub);
    const n = Number(limit ?? 20);
    const take = Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 20;
    const createdBefore = cursor ? new Date(cursor) : undefined;

    const posts = await this.prisma.posts.findMany({
      where: {
        match_id: id,
        parent_post_id: null,
        ...(createdBefore ? { created_at: { lt: createdBefore } } : {}),
        ...(await this.moderation.visibility(viewer.id)),
      },
      orderBy: { created_at: 'desc' },
      take,
      select: feedPostSelect(viewer.id),
    });

    const nextCursor = posts.length === take ? posts[posts.length - 1].created_at.toISOString() : null;
    return { posts: posts.map((p) => toFeedPost(p, viewer.id)), nextCursor };
  }
}
