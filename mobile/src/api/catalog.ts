// Shared fetch helpers for the teams/topics catalog, so the composer doesn't
// duplicate the inline apiFetch calls the onboarding screens use.
// (Onboarding is intentionally left as-is; it can adopt these later.)
import { apiFetch } from "./client";

export type Team = { id: string; name: string; logo_url: string | null };
export type Topic = { id: string; name: string; description: string | null; icon: string | null };

// Empty query returns the full list (backend caps at 25; there are far fewer).
export async function searchTeams(q: string = ""): Promise<Team[]> {
  const data = await apiFetch(`/teams/search?q=${encodeURIComponent(q)}`, { auth: true });
  return data?.teams ?? [];
}

export async function searchTopics(q: string = ""): Promise<Topic[]> {
  const data = await apiFetch(`/topics/search?q=${encodeURIComponent(q)}`, { auth: true });
  return data?.topics ?? [];
}
