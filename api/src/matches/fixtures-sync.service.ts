import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { FdMatch, FdTeam, fetchMatches, isoDay, normaliseTeamName, toMatchStatus } from './football-data';

const LIVE_STATUSES = ['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'] as const;
const DAY_MS = 86_400_000;

// Pulls fixtures and scores from football-data.org into the matches table.
// One request per run (yesterday through the next eight days), every five
// minutes, plus every minute while something is live: well inside the free
// tier's 10 calls a minute. Without FOOTBALL_DATA_TOKEN the sync is disabled.
@Injectable()
export class FixturesSyncService implements OnModuleInit {
  private readonly logger = new Logger(FixturesSyncService.name);
  private lastRun = 0;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get token(): string {
    return this.config.get<string>('FOOTBALL_DATA_TOKEN') ?? '';
  }

  onModuleInit() {
    if (!this.token) {
      this.logger.warn('FOOTBALL_DATA_TOKEN not set: fixtures sync disabled');
      return;
    }
    void this.sync('startup');
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  scheduled() {
    return this.sync('cron');
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async whileLive() {
    const live = await this.prisma.matches.count({ where: { status: { in: [...LIVE_STATUSES] } } });
    if (live > 0) await this.sync('live');
  }

  // Throttled so manual triggers and overlapping crons can't burn the quota.
  async sync(reason: string, minIntervalMs = 45_000): Promise<{ skipped: boolean; upserted?: number; mapped?: number }> {
    if (!this.token || this.running || Date.now() - this.lastRun < minIntervalMs) return { skipped: true };
    this.running = true;
    try {
      const now = Date.now();
      const matches = await fetchMatches(this.token, isoDay(new Date(now - DAY_MS)), isoDay(new Date(now + 8 * DAY_MS)));
      const result = await this.apply(matches);
      this.lastRun = Date.now();
      this.logger.log(`fixtures sync (${reason}): ${result.upserted} matches, ${result.mapped} teams newly mapped`);
      return { skipped: false, ...result };
    } catch (e: any) {
      this.logger.warn(`fixtures sync (${reason}) failed: ${e?.message ?? e}`);
      return { skipped: true };
    } finally {
      this.running = false;
    }
  }

  // The database half, separated so it can run against a sample payload.
  async apply(matches: FdMatch[]): Promise<{ upserted: number; mapped: number }> {
    const teams = await this.prisma.teams.findMany({
      select: { id: true, name: true, external_id: true, logo_url: true },
    });
    const byExternal = new Map(teams.filter((t) => t.external_id !== null).map((t) => [t.external_id!, t]));
    const byName = new Map(teams.map((t) => [normaliseTeamName(t.name), t]));
    let mapped = 0;

    // Links an API team to a seeded team the first time its name matches, and
    // borrows the API crest if we have no logo yet.
    const resolve = async (fd: FdTeam): Promise<string | null> => {
      const known = byExternal.get(fd.id);
      if (known) return known.id;

      const candidate =
        byName.get(normaliseTeamName(fd.name)) ?? (fd.shortName ? byName.get(normaliseTeamName(fd.shortName)) : undefined);
      if (!candidate || candidate.external_id !== null) return null;

      await this.prisma.teams.update({
        where: { id: candidate.id },
        data: { external_id: fd.id, ...(candidate.logo_url ? {} : { logo_url: fd.crest }) },
      });
      candidate.external_id = fd.id;
      byExternal.set(fd.id, candidate);
      mapped++;
      return candidate.id;
    };

    let upserted = 0;
    for (const m of matches) {
      const [home_team_id, away_team_id] = [await resolve(m.homeTeam), await resolve(m.awayTeam)];
      const data = {
        competition: m.competition.code,
        competition_name: m.competition.name,
        home_team_id,
        away_team_id,
        home_name: m.homeTeam.shortName ?? m.homeTeam.name,
        away_name: m.awayTeam.shortName ?? m.awayTeam.name,
        home_crest: m.homeTeam.crest,
        away_crest: m.awayTeam.crest,
        kickoff_at: new Date(m.utcDate),
        status: toMatchStatus(m.status),
        minute: m.minute ?? null,
        home_score: m.score?.fullTime?.home ?? null,
        away_score: m.score?.fullTime?.away ?? null,
        updated_at: new Date(),
      };
      await this.prisma.matches.upsert({
        where: { external_id: m.id },
        create: { external_id: m.id, ...data },
        update: data,
      });
      upserted++;
    }
    return { upserted, mapped };
  }
}
