import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

const TEAM_SELECT = { id: true, name: true, logo_url: true, league: true, country: true };

// Shown on onboarding step 3 before the user types: the top two English divisions, then a
// handful of European giants. Labels and names match scripts/seed-data/teams.mjs; a league is
// matched together with its country because "Bundesliga" and "Super League" exist in several.
const FEATURED_LEAGUES = [
  { country: 'England', league: 'Premier League' },
  { country: 'England', league: 'Championship' },
];
const FEATURED_CLUBS = [
  'Real Madrid',
  'FC Barcelona',
  'Atlético de Madrid',
  'Bayern Munich',
  'Borussia Dortmund',
  'Paris Saint-Germain',
  'Juventus',
  'Inter',
  'AC Milan',
  'Napoli',
  'Ajax',
  'Benfica',
  'Porto',
  'Celtic',
  'Rangers',
];

function featuredRank(team: { league: string | null; country: string | null }) {
  const i = FEATURED_LEAGUES.findIndex(
    (l) => l.country === team.country && l.league === team.league,
  );
  return i === -1 ? FEATURED_LEAGUES.length : i;
}

@Controller('teams')
export class TeamsController {
  constructor(private readonly prisma: PrismaService) {}

  // No auth guard: onboarding calls these before the account is confirmed/signed in
  // (same reasoning as /auth/username-available and /auth/email-available). Both rely
  // on the global per-IP throttle in AppModule.
  @Get('search')
  async search(@Query('q') q?: string) {
    const query = (q ?? '').trim();

    const items = await this.prisma.teams.findMany({
      where: query
        ? { name: { contains: query, mode: 'insensitive' } }
        : undefined,
      orderBy: { name: 'asc' },
      take: 25,
      select: TEAM_SELECT,
    });

    return { teams: items };
  }

  @Get('featured')
  async featured() {
    const items = await this.prisma.teams.findMany({
      where: { OR: [...FEATURED_LEAGUES, { name: { in: FEATURED_CLUBS } }] },
      orderBy: { name: 'asc' },
      select: TEAM_SELECT,
    });

    // Premier League, then Championship, then the European picks; the sort is stable,
    // so each group stays alphabetical.
    items.sort((a, b) => featuredRank(a) - featuredRank(b));

    return { teams: items };
  }

  // Composer default list: the viewer's own clubs (primary first), then the other clubs of
  // each of those leagues, league by league. A Premier League fan sees the Premier League,
  // not the start of the alphabet. Empty until the profile has at least one club.
  @UseGuards(JwtAuthGuard)
  @Get('suggested')
  async suggested(@CurrentUser() user: { sub: string }) {
    const dbUser = await this.prisma.users.findUnique({
      where: { cognito_sub: user.sub },
      select: { id: true },
    });
    if (!dbUser) return { teams: [] };

    const mine = await this.prisma.user_teams.findMany({
      where: { user_id: dbUser.id },
      orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
      select: { teams: { select: TEAM_SELECT } },
    });
    const own = mine.map((row) => row.teams);
    if (own.length === 0) return { teams: [] };

    const leagues = own
      .filter((t) => t.league && t.country)
      .map((t) => ({ league: t.league as string, country: t.country as string }));
    const others = leagues.length
      ? await this.prisma.teams.findMany({
          where: { OR: leagues, id: { notIn: own.map((t) => t.id) } },
          orderBy: { name: 'asc' },
          select: TEAM_SELECT,
        })
      : [];
    // Grouped by league in the order of the viewer's clubs (primary club's league first);
    // the sort is stable, so each league stays alphabetical.
    const leagueRank = (t: { league: string | null; country: string | null }) =>
      leagues.findIndex((l) => l.league === t.league && l.country === t.country);
    others.sort((a, b) => leagueRank(a) - leagueRank(b));

    return { teams: [...own, ...others] };
  }
}
