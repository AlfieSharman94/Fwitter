import { AgeTier } from '@prisma/client';

const JUNIOR_MAX_AGE = 15; // 13–15 = JUNIOR, 16+ = STANDARD

/** Whole years between dob and now, using UTC so the result is deterministic server-side. */
export function calculateAge(dob: Date, now: Date = new Date()): number {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age--;
  }
  return age;
}

/** Server-authoritative age tier derived from date of birth. */
export function deriveAgeTier(dob: Date, now: Date = new Date()): AgeTier {
  return calculateAge(dob, now) <= JUNIOR_MAX_AGE ? AgeTier.JUNIOR : AgeTier.STANDARD;
}
