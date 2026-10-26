import { AgeTier } from '@prisma/client';
import { isConsentPending } from './consent-status';

const base = { id: 'u1', age_tier: AgeTier.JUNIOR, is_onboarded: true, consent_confirmed_at: null };

describe('isConsentPending', () => {
  it('is true for an onboarded JUNIOR without a confirmation', () => {
    expect(isConsentPending(base)).toBe(true);
  });

  it('is false once a guardian has confirmed', () => {
    expect(isConsentPending({ ...base, consent_confirmed_at: new Date() })).toBe(false);
  });

  it('is false for STANDARD accounts', () => {
    expect(isConsentPending({ ...base, age_tier: AgeTier.STANDARD })).toBe(false);
  });

  it('is false while onboarding is still in progress', () => {
    expect(isConsentPending({ ...base, is_onboarded: false })).toBe(false);
  });

  it('is false when there is no profile row yet', () => {
    expect(isConsentPending({ ...base, id: null })).toBe(false);
  });
});
