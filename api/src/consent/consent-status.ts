import { AgeTier } from '@prisma/client';

export type ConsentStatusInput = {
  id: string | null;
  age_tier: AgeTier;
  is_onboarded: boolean;
  consent_confirmed_at: Date | null;
};

// The one rule behind the gate and the profile's consent_pending flag: a JUNIOR account that has
// finished onboarding is locked until a guardian confirms. Accounts still in onboarding (or with
// no profile row yet) are left alone so sign-up can finish.
export function isConsentPending(s: ConsentStatusInput): boolean {
  return s.id !== null && s.age_tier === AgeTier.JUNIOR && s.is_onboarded && !s.consent_confirmed_at;
}
