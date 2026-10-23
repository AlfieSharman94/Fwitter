// Match shape as returned by GET /matches and GET /matches/:id, plus display helpers.
export type MatchStatus =
  | "SCHEDULED"
  | "TIMED"
  | "IN_PLAY"
  | "PAUSED"
  | "EXTRA_TIME"
  | "PENALTY_SHOOTOUT"
  | "FINISHED"
  | "SUSPENDED"
  | "POSTPONED"
  | "CANCELLED"
  | "AWARDED";

export type Match = {
  id: string;
  competition: string;
  competition_name: string;
  home_name: string;
  away_name: string;
  home_crest: string | null;
  away_crest: string | null;
  kickoff_at: string;
  status: MatchStatus;
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  home_team: { id: string; name: string } | null;
  away_team: { id: string; name: string } | null;
  post_count: number;
};

const LIVE: MatchStatus[] = ["IN_PLAY", "PAUSED", "EXTRA_TIME", "PENALTY_SHOOTOUT"];

export function isLive(status: MatchStatus) {
  return LIVE.includes(status);
}

export function hasScore(m: Match) {
  return m.home_score !== null && m.away_score !== null && (isLive(m.status) || m.status === "FINISHED" || m.status === "AWARDED");
}

// Short badge text: "LIVE 67'", "HT", "FT", "20:00", "Postponed".
export function statusLabel(m: Match) {
  switch (m.status) {
    case "IN_PLAY":
      return m.minute !== null ? `LIVE ${m.minute}'` : "LIVE";
    case "PAUSED":
      return "HT";
    case "EXTRA_TIME":
      return "ET";
    case "PENALTY_SHOOTOUT":
      return "PENS";
    case "FINISHED":
    case "AWARDED":
      return "FT";
    case "POSTPONED":
      return "Postponed";
    case "CANCELLED":
      return "Cancelled";
    case "SUSPENDED":
      return "Suspended";
    default:
      return kickoffTime(m.kickoff_at);
  }
}

export function kickoffTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// "Today", "Tomorrow", "Yesterday" or "Sat 25 Oct".
export function dayLabel(iso: string, now = new Date()) {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(d) - startOf(now)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}
