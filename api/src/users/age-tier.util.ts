import { AgeTier, LinkStatus, Prisma } from '@prisma/client';

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

export type TierVisibility = { age_tier: AgeTier; public_profile: boolean };

// Private by default for 13 to 15s: a STANDARD viewer sees a JUNIOR account only once it has
// opted in to a public profile, while the JUNIOR follows that viewer (so they can follow back),
// or while the JUNIOR shares their activity with that viewer through a linked account. Within a
// tier nothing is hidden, and JUNIOR viewers see STANDARD accounts as before. DMs have their
// own, stricter rule (DmService.eligibility).
export function canSeeUser(viewerTier: AgeTier, target: TierVisibility, connectedToViewer = false): boolean {
  if (viewerTier === AgeTier.JUNIOR || target.age_tier !== AgeTier.JUNIOR) return true;
  return target.public_profile || connectedToViewer;
}

/**
 * The same rule as a Prisma `where` on users; null when the viewer may see everyone. Without
 * connectedTo the follow-back and linked-account exceptions are left out, which is what
 * discovery (search, mentions, other people's lists) wants.
 */
export function visibleUsersWhere(viewerTier: AgeTier, connectedTo?: string): Prisma.usersWhereInput | null {
  if (viewerTier === AgeTier.JUNIOR) return null;
  return {
    OR: [
      { age_tier: { not: AgeTier.JUNIOR } },
      { public_profile: true },
      ...(connectedTo
        ? [
            { follows_follows_follower_idTousers: { some: { following_id: connectedTo } } },
            { links_as_sharer: { some: { viewer_id: connectedTo, status: LinkStatus.ACTIVE } } },
          ]
        : []),
    ],
  };
}
