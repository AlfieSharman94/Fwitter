import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AgeTier } from '@prisma/client';
import { CreateProfileDto } from './create-profile.dto';

// Mirrors what the global ValidationPipe runs; a non-empty result => HTTP 400.
function build(overrides: Record<string, unknown> = {}) {
  return plainToInstance(CreateProfileDto, {
    username: 'harry_k',
    displayName: 'Harry Kane',
    dateOfBirth: '2000-01-15',
    ageTier: AgeTier.STANDARD,
    ...overrides,
  });
}

async function invalidProps(dto: object): Promise<string[]> {
  const errors = await validate(dto);
  return errors.map((e) => e.property);
}

describe('CreateProfileDto validation', () => {
  it('passes for a valid 16+ STANDARD profile', async () => {
    expect(await invalidProps(build())).toEqual([]);
  });

  it('passes for a JUNIOR (13–15) profile', async () => {
    expect(
      await invalidProps(build({ dateOfBirth: '2011-01-15', ageTier: AgeTier.JUNIOR })),
    ).toEqual([]);
  });

  it('rejects a DOB under 13', async () => {
    expect(
      await invalidProps(build({ dateOfBirth: '2020-01-01', ageTier: AgeTier.JUNIOR })),
    ).toContain('dateOfBirth');
  });

  it('rejects a malformed date string', async () => {
    expect(await invalidProps(build({ dateOfBirth: '15/01/2000' }))).toContain('dateOfBirth');
  });

  it('rejects an impossible calendar date', async () => {
    expect(await invalidProps(build({ dateOfBirth: '2000-13-40' }))).toContain('dateOfBirth');
  });

  it('allows a missing ageTier (server derives it from dateOfBirth)', async () => {
    expect(await invalidProps(build({ ageTier: undefined }))).toEqual([]);
  });

  it('rejects an invalid ageTier value', async () => {
    expect(await invalidProps(build({ ageTier: 'PREMIUM' }))).toContain('ageTier');
  });

  it('rejects a missing dateOfBirth', async () => {
    expect(await invalidProps(build({ dateOfBirth: undefined }))).toContain('dateOfBirth');
  });

  it('rejects an empty dateOfBirth', async () => {
    expect(await invalidProps(build({ dateOfBirth: '' }))).toContain('dateOfBirth');
  });

  it('rejects a whitespace-only dateOfBirth', async () => {
    expect(await invalidProps(build({ dateOfBirth: '   ' }))).toContain('dateOfBirth');
  });

  // The DTO still accepts a client ageTier that disagrees with DOB, but the
  // controller now ignores the client value and re-derives the tier from DOB.
  // (See age-tier.util.spec.ts for the derivation.)
  it('accepts a client ageTier that disagrees with DOB (controller re-derives it)', async () => {
    const juniorDob = '2012-01-01'; // age 14 on 2026-07-14 -> controller stores JUNIOR
    expect(
      await invalidProps(build({ dateOfBirth: juniorDob, ageTier: AgeTier.STANDARD })),
    ).toEqual([]);
  });

  it('allows exactly-13-today but rejects when the 13th birthday is tomorrow', async () => {
    const now = new Date();
    const fmt = (y: number, m: number, d: number) =>
      `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    // 13 years ago today -> age 13 -> allowed
    const today13 = fmt(now.getUTCFullYear() - 13, now.getUTCMonth() + 1, now.getUTCDate());
    expect(
      await invalidProps(build({ dateOfBirth: today13, ageTier: AgeTier.JUNIOR })),
    ).toEqual([]);

    // 13th birthday tomorrow -> still 12 -> rejected
    const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const bdayTomorrow = fmt(t.getUTCFullYear() - 13, t.getUTCMonth() + 1, t.getUTCDate());
    expect(
      await invalidProps(build({ dateOfBirth: bdayTomorrow, ageTier: AgeTier.JUNIOR })),
    ).toContain('dateOfBirth');
  });
});
