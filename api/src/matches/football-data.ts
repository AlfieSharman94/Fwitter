// Thin client for football-data.org v4 plus the name matching used to link API
// teams to the seeded teams table. Network access is isolated here so the sync
// logic can be exercised with a sample payload.
import { MatchStatus } from '@prisma/client';

export type FdTeam = {
  id: number;
  name: string;
  shortName: string | null;
  tla: string | null;
  crest: string | null;
};

export type FdMatch = {
  id: number;
  utcDate: string;
  status: string;
  minute?: number | null;
  competition: { id: number; code: string; name: string };
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score: {
    winner: string | null;
    duration: string;
    // During play fullTime holds the running score.
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
};

const BASE_URL = 'https://api.football-data.org/v4';

// yyyy-MM-dd in UTC, which is what the API's date filters expect.
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Every match in the free-tier competitions between the two dates (dateTo exclusive).
export async function fetchMatches(token: string, dateFrom: string, dateTo: string): Promise<FdMatch[]> {
  const res = await fetch(`${BASE_URL}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`, {
    headers: { 'X-Auth-Token': token },
  });
  if (!res.ok) throw new Error(`football-data.org responded ${res.status}`);
  const json = (await res.json()) as { matches?: FdMatch[] };
  return json.matches ?? [];
}

const STATUSES = new Set<string>(Object.values(MatchStatus));

export function toMatchStatus(raw: string): MatchStatus {
  return STATUSES.has(raw) ? (raw as MatchStatus) : MatchStatus.SCHEDULED;
}

// API names that don't reduce to the seeded name by stripping club words.
const ALIASES: Record<string, string> = {
  'fc bayern münchen': 'bayern munich',
  'club atlético de madrid': 'atlético de madrid',
  'fc internazionale milano': 'inter',
};

// "Arsenal FC" -> "arsenal", "Real Madrid CF" -> "real madrid", "FC Barcelona" -> "barcelona".
export function normaliseTeamName(name: string): string {
  const lower = name.trim().toLowerCase();
  if (ALIASES[lower]) return ALIASES[lower];
  return lower
    .replace(/\b(fc|cf|afc|cfc|ssc|club)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
