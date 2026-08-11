// Maps backend follow/unfollow error codes to friendly, user-facing copy.
const FRIENDLY: Record<string, string> = {
  cannot_follow_self: "You can't follow yourself.",
  user_not_found: "That account no longer exists.",
  viewer_profile_not_found: "We couldn't find your profile. Please sign in again.",
};

export function followErrorMessage(
  e: any,
  fallback = "Something went wrong. Please try again.",
): string {
  const raw = (e?.message ?? "").trim();
  if (FRIENDLY[raw]) return FRIENDLY[raw];
  // apiFetch surfaces network/session problems as full sentences — pass those through.
  if (raw.includes(" ")) return raw;
  // A bare, unknown backend code isn't user-friendly — use the fallback.
  return fallback;
}
