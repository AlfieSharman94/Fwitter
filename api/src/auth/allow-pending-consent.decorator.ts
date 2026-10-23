import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_CONSENT_KEY = 'allowPendingConsent';

/**
 * Lets a JUNIOR account whose guardian has not yet confirmed reach this route. JwtAuthGuard
 * refuses everything else with 403 consent_pending. Use only for what the pending screen and
 * sign-out need: reading the own profile, the guardian email routes, account deletion, and the
 * onboarding calls a resumed sign-up re-runs.
 */
export const AllowPendingConsent = () => SetMetadata(ALLOW_PENDING_CONSENT_KEY, true);
