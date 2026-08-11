# Fwitter — Follow-ups

Deferred work items found during development. Not yet scheduled.

## Onboarding: resumable/idempotent completion after partial failure
**Where:** `mobile/app/(onboarding)/topics.tsx` (`handleContinue`) and `mobile/app/(auth)/confirm-signup.tsx` (`onSubmit`).

**Problem:** Both run a sequence — Cognito `signUp`/`confirmSignUp` + `signIn`, then `POST /users/me/profile`, `PUT /users/me/teams`, `PUT /users/me/topics`, `POST /users/me/onboarding/complete` — in a single try/catch with no resume logic. The backend API calls are idempotent, but the leading Cognito calls are not: if any step after confirmation fails (network blip, API hiccup), retrying re-runs `confirmSignUp`/`signUp` on an already-existing account, which throws. The user is left confirmed-but-not-onboarded with no clean in-app recovery.

**Suggested fix:** Tolerate "already confirmed" / "already exists" on the Cognito step and continue; and/or move the profile-setup steps into an idempotent "resume onboarding" routine keyed off `GET /users/me/profile` + `is_onboarded`, run on app launch when signed-in-but-not-onboarded. Reads onboarding data from `fwitter.onboarding.data`.

## Minor / optional
- `mobile`: onboarding screens (`team-selection.tsx`, `topics.tsx`) still inline `apiFetch('/teams/search…')` / `topics`. A shared helper now exists at `src/api/catalog.ts` (`searchTeams`/`searchTopics`, used by the composer) — onboarding could adopt it to remove the duplication. Left unchanged for now to keep onboarding untouched.
- `mobile`: `topics.tsx` and `confirm-signup.tsx` still send `ageTier` in the `POST /users/me/profile` body. The server now derives the tier from `dateOfBirth` and ignores this field, so it can be removed from the client bodies (harmless if left).
- `mobile`: pre-existing `tsc --noEmit` errors unrelated to features — `src/auth/amplify.ts` (`region` not in Amplify v6 config type), `src/auth/auth.ts` (`refreshToken` not on `AuthTokens`), and missing type declarations for `jsbn` / `text-encoding` in `src/polyfills/*`. Runtime is fine (Metro doesn't typecheck); clean up when convenient.
