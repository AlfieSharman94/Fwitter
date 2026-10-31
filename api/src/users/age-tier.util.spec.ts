import { AgeTier } from '@prisma/client';
import { calculateAge, canSeeUser, deriveAgeTier, visibleUsersWhere } from './age-tier.util';

const NOW = new Date(Date.UTC(2026, 6, 14)); // 2026-07-14
const dob = (s: string) => new Date(s);

describe('deriveAgeTier (server-authoritative)', () => {
  it('derives STANDARD for 16+', () => {
    expect(deriveAgeTier(dob('2010-07-14'), NOW)).toBe(AgeTier.STANDARD); // exactly 16
    expect(deriveAgeTier(dob('2000-01-01'), NOW)).toBe(AgeTier.STANDARD);
  });

  it('derives JUNIOR for 13–15', () => {
    expect(deriveAgeTier(dob('2013-07-14'), NOW)).toBe(AgeTier.JUNIOR); // exactly 13
    expect(deriveAgeTier(dob('2011-07-14'), NOW)).toBe(AgeTier.JUNIOR); // exactly 15
    expect(deriveAgeTier(dob('2010-07-15'), NOW)).toBe(AgeTier.JUNIOR); // 15 (16th bday tomorrow)
  });

  it('re-derives from DOB regardless of any client-claimed tier', () => {
    // A 14-year-old is always JUNIOR, even if the client sent STANDARD.
    expect(deriveAgeTier(dob('2012-01-01'), NOW)).toBe(AgeTier.JUNIOR);
  });

  it('calculateAge handles the birthday-today vs tomorrow boundary', () => {
    expect(calculateAge(dob('2013-07-14'), NOW)).toBe(13);
    expect(calculateAge(dob('2013-07-15'), NOW)).toBe(12);
  });
});

describe('canSeeUser (private by default for 13 to 15s)', () => {
  const privateJunior = { age_tier: AgeTier.JUNIOR, public_profile: false };
  const publicJunior = { age_tier: AgeTier.JUNIOR, public_profile: true };
  const standard = { age_tier: AgeTier.STANDARD, public_profile: false };

  it('a JUNIOR viewer sees everyone', () => {
    expect(canSeeUser(AgeTier.JUNIOR, privateJunior)).toBe(true);
    expect(canSeeUser(AgeTier.JUNIOR, publicJunior)).toBe(true);
    expect(canSeeUser(AgeTier.JUNIOR, standard)).toBe(true);
  });

  it('a STANDARD viewer sees STANDARD accounts and JUNIORs who opted in', () => {
    expect(canSeeUser(AgeTier.STANDARD, standard)).toBe(true);
    expect(canSeeUser(AgeTier.STANDARD, publicJunior)).toBe(true);
    expect(canSeeUser(AgeTier.STANDARD, privateJunior)).toBe(false);
  });

  it('a STANDARD viewer also sees a private JUNIOR who follows them', () => {
    expect(canSeeUser(AgeTier.STANDARD, privateJunior, true)).toBe(true);
  });

  it('visibleUsersWhere is the same rule as a where fragment', () => {
    expect(visibleUsersWhere(AgeTier.JUNIOR)).toBeNull();
    expect(visibleUsersWhere(AgeTier.STANDARD)).toEqual({
      OR: [{ age_tier: { not: AgeTier.JUNIOR } }, { public_profile: true }],
    });
    expect(visibleUsersWhere(AgeTier.STANDARD, 'me')).toEqual({
      OR: [
        { age_tier: { not: AgeTier.JUNIOR } },
        { public_profile: true },
        { follows_follows_follower_idTousers: { some: { following_id: 'me' } } },
        { links_as_sharer: { some: { viewer_id: 'me', status: 'ACTIVE' } } },
      ],
    });
  });
});
