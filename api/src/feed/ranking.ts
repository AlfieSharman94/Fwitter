// Heuristic ranking for the "For you" feed. Pure functions so the scoring and
// paging can be unit tested without a database.
//
// score = engagement * affinity / decay
//   engagement: 1 + likes + 2*replies + 3*reposts + 3*quotes (a bare post scores 1)
//   affinity:   x1.5 if you follow the author, x1.3 if it's tagged with your primary team
//   decay:      (ageHours + 2) ^ 1.5, so a fresh post beats an older one with a few
//               likes, but a popular post stays up for a day or two
//
// Paging is by (score, id) at a fixed `asOf` time carried in the cursor, so later
// pages are scored with the same clock and never repeat or skip a post.

export type Candidate = {
  id: string;
  author_id: string;
  created_at: Date;
  like_count: number;
  reply_count: number;
  repost_count: number;
  quote_count: number;
  followed: boolean;
  primaryTeam: boolean;
};

export type RankCursor = { asOf: string; score: number; id: string };

export function scorePost(c: Candidate, asOf: Date): number {
  const engagement = 1 + c.like_count + 2 * c.reply_count + 3 * c.repost_count + 3 * c.quote_count;
  const affinity = (c.followed ? 1.5 : 1) * (c.primaryTeam ? 1.3 : 1);
  const ageHours = Math.max(0, (asOf.getTime() - c.created_at.getTime()) / 3_600_000);
  return (engagement * affinity) / Math.pow(ageHours + 2, 1.5);
}

export function encodeCursor(cursor: RankCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string | undefined): RankCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (
      typeof parsed?.asOf === 'string' &&
      Number.isFinite(parsed?.score) &&
      typeof parsed?.id === 'string' &&
      !Number.isNaN(Date.parse(parsed.asOf))
    ) {
      return { asOf: parsed.asOf, score: parsed.score, id: parsed.id };
    }
  } catch {
    // fall through
  }
  return null;
}

// At most two posts in a row from the same author: a third is pushed down until
// someone else has had a turn. Keeps one loud account from filling the screen.
export function spreadAuthors<T extends { author_id: string }>(items: T[]): T[] {
  const out: T[] = [];
  let deferred: T[] = [];
  const pending = [...items];

  while (pending.length || deferred.length) {
    const next = pending.length ? pending.shift()! : deferred.shift()!;
    const last = out[out.length - 1];
    const prev = out[out.length - 2];
    const runOfTwo = last && prev && last.author_id === next.author_id && prev.author_id === next.author_id;
    if (runOfTwo && pending.length) {
      deferred.push(next);
      continue;
    }
    out.push(next);
    // Give deferred items the first chance once the run is broken.
    if (deferred.length && out[out.length - 1].author_id !== deferred[0].author_id) {
      pending.unshift(...deferred);
      deferred = [];
    }
  }
  return out;
}

export function rankPage(
  candidates: Candidate[],
  asOf: Date,
  cursor: RankCursor | null,
  take: number,
): { ids: string[]; nextCursor: string | null } {
  const scored = candidates
    .map((c) => ({ id: c.id, author_id: c.author_id, score: scorePost(c, asOf) }))
    .filter((s) => !cursor || s.score < cursor.score || (s.score === cursor.score && s.id < cursor.id))
    .sort((a, b) => b.score - a.score || (a.id < b.id ? 1 : -1));

  const page = scored.slice(0, take);
  // The cursor is the page's lowest (score, id), which is still the last item in
  // score order even after authors are spread out.
  const tail = page[page.length - 1];
  const nextCursor =
    tail && scored.length > take ? encodeCursor({ asOf: asOf.toISOString(), score: tail.score, id: tail.id }) : null;

  return { ids: spreadAuthors(page).map((s) => s.id), nextCursor };
}
