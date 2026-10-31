import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AgeTier } from '@prisma/client';
import { ModerationService } from './moderation.service';

const junior = {
  id: 'u1',
  role: 'USER',
  suspended_until: null,
  banned_at: null,
  age_tier: 'JUNIOR',
  is_onboarded: true,
  guardian_consent: null as { confirmed_at: Date | null } | null,
};

function makeService(dbUser: Record<string, unknown> | null) {
  const findUnique = jest.fn().mockResolvedValue(dbUser);
  const service = new ModerationService({ users: { findUnique } } as any);
  return { service, findUnique };
}

describe('ModerationService.assertConsented', () => {
  it('refuses an onboarded JUNIOR until a guardian confirms', async () => {
    const { service } = makeService(junior);
    const err = await service.assertConsented('sub-1').catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse()).toEqual({ message: 'consent_pending' });
  });

  it('passes once consent is confirmed', async () => {
    const { service } = makeService({ ...junior, guardian_consent: { confirmed_at: new Date() } });
    await expect(service.assertConsented('sub-1')).resolves.toBeUndefined();
  });

  it('passes STANDARD accounts, accounts still onboarding, and missing rows', async () => {
    await expect(makeService({ ...junior, age_tier: 'STANDARD' }).service.assertConsented('sub-1')).resolves.toBeUndefined();
    await expect(makeService({ ...junior, is_onboarded: false }).service.assertConsented('sub-1')).resolves.toBeUndefined();
    await expect(makeService(null).service.assertConsented('sub-1')).resolves.toBeUndefined();
  });
});

describe('ModerationService status cache', () => {
  it('invalidateStatusBySub forces the next lookup', async () => {
    const { service, findUnique } = makeService(junior);
    await service.accountStatus('sub-1');
    await service.accountStatus('sub-1');
    expect(findUnique).toHaveBeenCalledTimes(1);
    service.invalidateStatusBySub('sub-1');
    await service.accountStatus('sub-1');
    expect(findUnique).toHaveBeenCalledTimes(2);
  });
});

type Row = { id: string; age_tier: AgeTier; public_profile: boolean };
type Block = { blocker_id: string; blocked_id: string };
type Follow = { follower_id: string; following_id: string };

// Prisma stand-in: users looked up by id, blocks and follows as rows.
function setup(users: Row[], blocks: Block[] = [], follows: Follow[] = []) {
  const prisma = {
    users: {
      findUnique: jest.fn(async ({ where }: any) => users.find((u) => u.id === where.id) ?? null),
    },
    follows: {
      count: jest.fn(
        async ({ where }: any) =>
          follows.filter((f) => f.follower_id === where.follower_id && f.following_id === where.following_id).length,
      ),
    },
    blocks: {
      findMany: jest.fn(async ({ where }: any) => {
        const viewer = where.OR[0].blocker_id;
        return blocks.filter((b) => b.blocker_id === viewer || b.blocked_id === viewer);
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        const pairs = where.OR as Block[];
        return blocks.find((b) => pairs.some((p) => p.blocker_id === b.blocker_id && p.blocked_id === b.blocked_id)) ?? null;
      }),
    },
  } as any;
  return { prisma, service: new ModerationService(prisma) };
}

const std: Row = { id: 'std', age_tier: AgeTier.STANDARD, public_profile: false };
const jr: Row = { id: 'jr', age_tier: AgeTier.JUNIOR, public_profile: false };
const jrPublic: Row = { id: 'jrpub', age_tier: AgeTier.JUNIOR, public_profile: true };
const jr2: Row = { id: 'jr2', age_tier: AgeTier.JUNIOR, public_profile: false };
const ALL = [std, jr, jrPublic, jr2];

// What every viewer gets for one posts row: no posts across a block, hidden posts only if their own.
const base = (viewerId: string, blocked: string[]) => [
  ...(blocked.length ? [{ author_id: { notIn: blocked } }] : []),
  { OR: [{ hidden_at: null }, { author_id: viewerId }] },
];
const author = { OR: [{ age_tier: { not: AgeTier.JUNIOR } }, { public_profile: true }] };
// Posts also let through private JUNIORs who follow the viewer.
const authorFor = (viewerId: string) => ({
  OR: [...author.OR, { follows_follows_follower_idTousers: { some: { following_id: viewerId } } }],
});
// The row rules again on the originals inside quote and repost embeds (a repost embeds a quoting post).
const withEmbeds = (post: object[]) => {
  const quoting = [...post, { OR: [{ quoted_post_id: null }, { quoted_post: { AND: post } }] }];
  return { AND: [...quoting, { OR: [{ repost_of_id: null }, { repost_of: { AND: quoting } }] }] };
};

describe('ModerationService.visibilityWhere', () => {
  const { service } = setup(ALL);

  it('is blocks and hidden posts, on the row and inside its embeds, for a JUNIOR viewer', () => {
    expect(service.visibilityWhere('jr2', [], AgeTier.JUNIOR)).toEqual(withEmbeds(base('jr2', [])));
    expect(service.visibilityWhere('jr2', ['x'], AgeTier.JUNIOR)).toEqual(withEmbeds(base('jr2', ['x'])));
  });

  it('adds the author rule, also inside the embeds, for a STANDARD viewer', () => {
    expect(service.visibilityWhere('std', ['x'], AgeTier.STANDARD)).toEqual(
      withEmbeds([...base('std', ['x']), { users: authorFor('std') }]),
    );
  });
});

// Evaluates a fragment against an in-memory row: AND / OR, equality, `not`, `notIn`, and a
// nested object as a to-one relation that must exist and match. Enough for the shapes above.
function matches(where: any, row: any): boolean {
  return Object.entries(where).every(([key, cond]: [string, any]) => {
    if (key === 'AND') return cond.every((c: any) => matches(c, row));
    if (key === 'OR') return cond.some((c: any) => matches(c, row));
    const value = row[key];
    if (cond === null || typeof cond !== 'object') return value === cond;
    if ('some' in cond) return (value ?? []).some((v: any) => matches(cond.some, v));
    if ('notIn' in cond) return !cond.notIn.includes(value);
    if ('not' in cond) return value !== cond.not;
    return value != null && matches(cond, value);
  });
}

type FakePost = {
  author_id: string;
  users: Row;
  hidden_at: Date | null;
  quoted_post_id: string | null;
  quoted_post: FakePost | null;
  repost_of_id: string | null;
  repost_of: FakePost | null;
};
type Embeds = { quoted?: FakePost; repostOf?: FakePost; hidden?: boolean };
const post = (author: Row, { quoted, repostOf, hidden }: Embeds = {}): FakePost => ({
  author_id: author.id,
  users: author,
  hidden_at: hidden ? new Date() : null,
  quoted_post_id: quoted ? 'q' : null,
  quoted_post: quoted ?? null,
  repost_of_id: repostOf ? 'r' : null,
  repost_of: repostOf ?? null,
});

describe('ModerationService.visibilityWhere on embedded originals', () => {
  const { service } = setup(ALL);
  const blocked: Row = { id: 'blocked', age_tier: AgeTier.STANDARD, public_profile: false };
  const other: Row = { id: 'other', age_tier: AgeTier.STANDARD, public_profile: false };
  const visible = (row: FakePost) => matches(service.visibilityWhere('std', ['blocked'], AgeTier.STANDARD), row);

  it('drops a quote or repost whose original is by a blocked author', () => {
    expect(visible(post(other, { quoted: post(blocked) }))).toBe(false);
    expect(visible(post(other, { repostOf: post(blocked) }))).toBe(false);
    expect(visible(post(other, { quoted: post(other) }))).toBe(true);
  });

  it("drops a quote or repost whose original is hidden, unless the original is the viewer's own", () => {
    expect(visible(post(other, { quoted: post(other, { hidden: true }) }))).toBe(false);
    expect(visible(post(other, { repostOf: post(other, { hidden: true }) }))).toBe(false);
    expect(visible(post(other, { quoted: post(std, { hidden: true }) }))).toBe(true);
  });

  it("shows a private JUNIOR's posts only to STANDARD accounts that JUNIOR follows", () => {
    const followsStd = { ...jr, follows_follows_follower_idTousers: [{ following_id: 'std' }] } as Row;
    expect(visible(post(jr))).toBe(false);
    expect(visible(post(followsStd))).toBe(true);
  });

  it('drops a repost of a quote whose original fails', () => {
    expect(visible(post(other, { repostOf: post(other, { quoted: post(blocked) }) }))).toBe(false);
    expect(visible(post(other, { repostOf: post(other, { quoted: post(other) }) }))).toBe(true);
  });
});

describe('ModerationService.visibility', () => {
  it('loads the viewer tier and blocked ids', async () => {
    const { service } = setup(ALL, [
      { blocker_id: 'std', blocked_id: 'x' },
      { blocker_id: 'y', blocked_id: 'std' },
    ]);
    expect(await service.visibility('std')).toEqual(service.visibilityWhere('std', ['x', 'y'], AgeTier.STANDARD));
    expect(await service.visibility('jr2')).toEqual(service.visibilityWhere('jr2', [], AgeTier.JUNIOR));
  });

  it('treats an unknown viewer as STANDARD', async () => {
    const { service } = setup(ALL);
    expect(await service.viewerTier('ghost')).toBe(AgeTier.STANDARD);
  });
});

describe('ModerationService user visibility', () => {
  const { service } = setup(ALL);

  it('isUserVisible follows the tier rule and is false for a missing target', async () => {
    expect(await service.isUserVisible('std', 'jr')).toBe(false);
    expect(await service.isUserVisible('std', 'jrpub')).toBe(true);
    expect(await service.isUserVisible('jr2', 'jr')).toBe(true);
    expect(await service.isUserVisible('jr', 'std')).toBe(true);
    expect(await service.isUserVisible('std', 'ghost')).toBe(false);
  });

  it('shows a private JUNIOR to a STANDARD account only while the JUNIOR follows it', async () => {
    const { service: s } = setup(ALL, [], [{ follower_id: 'jr', following_id: 'std' }]);
    expect(await s.isUserVisible('std', 'jr')).toBe(true);
    expect(await s.isUserVisible('std', 'jr2')).toBe(false);
  });

  it('includeOwnFollowers adds the follow-back clause for the viewer', async () => {
    expect(await service.usersVisibleTo('std', true)).toEqual(authorFor('std'));
  });

  it('assertUserVisible answers not found for a private JUNIOR', async () => {
    await expect(service.assertUserVisible('std', 'jr')).rejects.toThrow(NotFoundException);
    await expect(service.assertUserVisible('std', 'jrpub')).resolves.toBeUndefined();
  });

  it('usersVisibleTo is null for a JUNIOR viewer and the fragment for a STANDARD one', async () => {
    expect(await service.usersVisibleTo('jr2')).toBeNull();
    expect(await service.usersVisibleTo('std')).toEqual(author);
  });
});

describe('ModerationService.assertVisible', () => {
  const { service } = setup(ALL);
  const shown = (author_id: string) => ({ author_id, hidden_at: null });

  it('hides a private JUNIOR author from a STANDARD viewer, but not from a JUNIOR one', async () => {
    await expect(service.assertVisible('std', shown('jr'))).rejects.toThrow(NotFoundException);
    await expect(service.assertVisible('std', shown('jrpub'))).resolves.toBeUndefined();
    await expect(service.assertVisible('jr2', shown('jr'))).resolves.toBeUndefined();
  });

  it('keeps the existing rules: own hidden post ok, hidden post of someone else not found', async () => {
    await expect(service.assertVisible('jr', { author_id: 'jr', hidden_at: new Date() })).resolves.toBeUndefined();
    await expect(service.assertVisible('std', { author_id: 'std2', hidden_at: new Date() })).rejects.toThrow(NotFoundException);
  });
});
