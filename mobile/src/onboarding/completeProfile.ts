// mobile/src/onboarding/completeProfile.ts
import { apiFetch } from "../api/client";

type OnboardingData = {
  username: string;
  displayName: string;
  dateOfBirth: string;
  ageTier: string;
  primaryTeamId?: string;
  teamIds?: string[];
  topicIds?: string[];
};

/**
 * The four API calls that turn a signed-in Cognito user into a fully onboarded
 * Fwitter profile. Shared by topics.tsx (auto-confirmed signup) and
 * confirm-signup.tsx (email-code signup) so the sequence — and any future
 * fix to it — only needs to live in one place.
 *
 * Each step is safe to re-run: profile creation is idempotent server-side, and
 * the teams/topics PUTs and the completion POST just overwrite/re-confirm
 * state rather than erroring on a second call. That matters because this can
 * legitimately run twice for the same account (e.g. resuming a signup that
 * got interrupted after the profile was already created once).
 */
export async function completeOnboardingProfile(data: OnboardingData) {
  await apiFetch("/users/me/profile", {
    method: "POST",
    body: JSON.stringify({
      username: data.username,
      displayName: data.displayName,
      dateOfBirth: data.dateOfBirth,
      ageTier: data.ageTier,
    }),
  });

  await apiFetch("/users/me/teams", {
    method: "PUT",
    body: JSON.stringify({
      primaryTeamId: data.primaryTeamId,
      teamIds: data.teamIds || (data.primaryTeamId ? [data.primaryTeamId] : []),
    }),
  });

  await apiFetch("/users/me/topics", {
    method: "PUT",
    body: JSON.stringify({
      topicIds: data.topicIds || [],
    }),
  });

  await apiFetch("/users/me/onboarding/complete", { method: "POST" });
}
