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

// Prisma stand-in: users looked up by id, blocks as rows.
function setup(users: Row[], blocks: Block[] = []) {
  const prisma = {
    users: {
      findUnique: jest.fn(async ({ where }: any) => users.find((u) => u.id === where.id) ?? null),
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

// What every viewer gets: no posts across a block, hidden posts only if their own.
const base = (viewerId: string, blocked: string[]) => [
  ...(blocked.length ? [{ author_id: { notIn: blocked } }] : []),
  { OR: [{ hidden_at: null }, { author_id: viewerId }] },
];
const author = { OR: [{ age_tier: { not: AgeTier.JUNIOR } }, { public_profile: true }] };

describe('ModerationService.visibilityWhere', () => {
  const { service } = setup(ALL);

  it('is unchanged for a JUNIOR viewer: blocks and hidden posts only', () => {
    expect(service.visibilityWhere('jr2', [], AgeTier.JUNIOR)).toEqual({ AND: base('jr2', []) });
    expect(service.visibilityWhere('jr2', ['x'], AgeTier.JUNIOR)).toEqual({ AND: base('jr2', ['x']) });
  });

  it('adds the author rule, also inside quote and repost embeds, for a STANDARD viewer', () => {
    expect(service.visibilityWhere('std', ['x'], AgeTier.STANDARD)).toEqual({
      AND: [
        ...base('std', ['x']),
        { users: author },
        { OR: [{ quoted_post_id: null }, { quoted_post: { users: author } }] },
        { OR: [{ repost_of_id: null }, { repost_of: { users: author } }] },
      ],
    });
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
