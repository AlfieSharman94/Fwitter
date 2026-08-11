import { AgeTier } from '@prisma/client';
import { calculateAge, deriveAgeTier } from './age-tier.util';

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
