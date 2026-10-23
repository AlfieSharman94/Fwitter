import { Controller, Get, Query } from '@nestjs/common';
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
}
