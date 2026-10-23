import { Candidate, decodeCursor, encodeCursor, rankPage, scorePost, spreadAuthors } from './ranking';

const asOf = new Date('2026-10-23T12:00:00Z');

function post(partial: Partial<Candidate> & { id: string }): Candidate {
  return {
    author_id: 'a',
    created_at: new Date(asOf.getTime() - 3_600_000),
    like_count: 0,
    reply_count: 0,
    repost_count: 0,
    quote_count: 0,
    followed: false,
    primaryTeam: false,
    ...partial,
  };
}

describe('scorePost', () => {
  it('ranks a fresh post above an older one with the same engagement', () => {
    const fresh = post({ id: 'f', created_at: new Date(asOf.getTime() - 600_000) });
    const old = post({ id: 'o', created_at: new Date(asOf.getTime() - 24 * 3_600_000) });
    expect(scorePost(fresh, asOf)).toBeGreaterThan(scorePost(old, asOf));
  });

  it('lets engagement overcome age', () => {
    const quiet = post({ id: 'q', created_at: new Date(asOf.getTime() - 600_000) });
    const popular = post({
      id: 'p',
      created_at: new Date(asOf.getTime() - 6 * 3_600_000),
      like_count: 20,
      reply_count: 5,
    });
    expect(scorePost(popular, asOf)).toBeGreaterThan(scorePost(quiet, asOf));
  });

  it('applies follow and primary-team affinity multiplicatively', () => {
    const base = post({ id: 'b' });
    const both = post({ id: 'x', followed: true, primaryTeam: true });
    expect(scorePost(both, asOf) / scorePost(base, asOf)).toBeCloseTo(1.5 * 1.3, 5);
  });

  it('never treats a future created_at as negative age', () => {
    const future = post({ id: 'z', created_at: new Date(asOf.getTime() + 60_000) });
    expect(scorePost(future, asOf)).toBe(1 / Math.pow(2, 1.5));
  });
});

describe('cursor', () => {
  it('round-trips and rejects garbage', () => {
    const c = { asOf: asOf.toISOString(), score: 0.123, id: 'abc' };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    expect(decodeCursor('not-base64-json')).toBeNull();
    expect(decodeCursor(Buffer.from('{"asOf":"nope"}').toString('base64url'))).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
  });
});

describe('spreadAuthors', () => {
  it('allows at most two in a row from one author', () => {
    const items = ['a', 'a', 'a', 'b', 'a', 'c'].map((author_id, i) => ({ id: String(i), author_id }));
    const authors = spreadAuthors(items).map((i) => i.author_id);
    for (let i = 2; i < authors.length; i++) {
      expect(authors[i] === authors[i - 1] && authors[i] === authors[i - 2]).toBe(false);
    }
    expect(authors.sort()).toEqual(['a', 'a', 'a', 'a', 'b', 'c']);
  });

  it('keeps order when nothing needs moving', () => {
    const items = ['a', 'b', 'a', 'b'].map((author_id, i) => ({ id: String(i), author_id }));
    expect(spreadAuthors(items).map((i) => i.id)).toEqual(['0', '1', '2', '3']);
  });
});

describe('rankPage', () => {
  const candidates = Array.from({ length: 7 }, (_, i) =>
    post({ id: `p${i}`, author_id: `u${i % 3}`, like_count: i * 3, created_at: new Date(asOf.getTime() - i * 3_600_000) }),
  );

  it('pages without repeating or skipping', () => {
    const page1 = rankPage(candidates, asOf, null, 3);
    expect(page1.ids).toHaveLength(3);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = rankPage(candidates, asOf, decodeCursor(page1.nextCursor!), 3);
    const page3 = rankPage(candidates, asOf, decodeCursor(page2.nextCursor!), 3);
    expect(page3.nextCursor).toBeNull();

    const all = [...page1.ids, ...page2.ids, ...page3.ids];
    expect(new Set(all).size).toBe(7);
    expect(all.sort()).toEqual(candidates.map((c) => c.id).sort());
  });

  it('returns no cursor when everything fits on one page', () => {
    expect(rankPage(candidates, asOf, null, 20).nextCursor).toBeNull();
  });
});
