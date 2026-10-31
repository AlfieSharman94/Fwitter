import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LinkShare, LinkStatus } from '@prisma/client';
import { CONSENT_LINK_SHARES, LinksService } from './links.service';

// expo-server-sdk (pulled in through the notifications service) is ESM-only.
jest.mock('../notifications/push.service', () => ({ PushService: class {} }));

const NOW = new Date('2026-10-31T12:00:00.000Z');
const dob = (s: string) => new Date(`${s}T00:00:00.000Z`);
const PEOPLE: Record<string, { id: string; date_of_birth: Date }> = {
  kid: { id: 'kid', date_of_birth: dob('2012-03-01') }, // 14
  teen: { id: 'teen', date_of_birth: dob('2009-06-01') }, // 17
  mum: { id: 'mum', date_of_birth: dob('1985-01-01') },
  dad: { id: 'dad', date_of_birth: dob('1984-01-01') },
  aunt: { id: 'aunt', date_of_birth: dob('1990-01-01') },
};

type LinkRow = {
  id: string;
  sharer_id: string;
  viewer_id: string;
  status: LinkStatus;
  shares: LinkShare[];
  requested_shares: LinkShare[];
  accepted_at: Date | null;
  stay_answered_at: Date | null;
};

function link(overrides: Partial<LinkRow> = {}): LinkRow {
  return {
    id: 'l1',
    sharer_id: 'kid',
    viewer_id: 'mum',
    status: LinkStatus.ACTIVE,
    shares: [LinkShare.POSTS, LinkShare.MESSAGES],
    requested_shares: [],
    accepted_at: NOW,
    stay_answered_at: null,
    ...overrides,
  };
}

function setup(existing: LinkRow | null = null, linkCount = 0) {
  const prisma = {
    users: { findUnique: jest.fn(async ({ where }: any) => PEOPLE[where.id] ?? null) },
    account_links: {
      findUnique: jest.fn().mockResolvedValue(existing),
      create: jest.fn().mockResolvedValue({ id: 'new' }),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(linkCount),
    },
    posts: { findMany: jest.fn().mockResolvedValue([]) },
    follows: { findMany: jest.fn().mockResolvedValue([]) },
    messages: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const moderation = { assertCanInteract: jest.fn().mockResolvedValue(undefined) };
  const service = new LinksService(prisma as any, notifications as any, moderation as any);
  return { service, prisma, notifications };
}

describe('LinksService.request', () => {
  it('creates a pending link the sharer chose, and tells the viewer', async () => {
    const { service, prisma, notifications } = setup();
    await service.request('kid', 'mum', [LinkShare.POSTS, LinkShare.POSTS, LinkShare.REPLIES], NOW);
    expect(prisma.account_links.create).toHaveBeenCalledWith({
      data: { sharer_id: 'kid', viewer_id: 'mum', shares: [LinkShare.POSTS, LinkShare.REPLIES] },
      select: { id: true },
    });
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ recipientId: 'mum', actorId: 'kid', type: 'LINK' }));
  });

  it('only links to an 18+ viewer, so an adult can never ask to see a child', async () => {
    const { service } = setup();
    await expect(service.request('mum', 'kid', [LinkShare.POSTS], NOW)).rejects.toThrow(new BadRequestException('link_viewer_too_young'));
    await expect(service.request('mum', 'teen', [LinkShare.POSTS], NOW)).rejects.toThrow(new BadRequestException('link_viewer_too_young'));
    await expect(service.request('mum', 'mum', [LinkShare.POSTS], NOW)).rejects.toThrow(new BadRequestException('cannot_link_self'));
  });

  it('lets a child link to at most two adults', async () => {
    const { service } = setup(null, 2);
    await expect(service.request('kid', 'aunt', [LinkShare.POSTS], NOW)).rejects.toThrow(new BadRequestException('link_limit_reached'));
    const adult = setup(null, 5);
    await expect(adult.service.request('teen', 'aunt', [LinkShare.POSTS], NOW)).resolves.toEqual({ id: 'new' });
  });
});

describe('LinksService.remove', () => {
  it('a child under 16 cannot end an active link; the viewer can', async () => {
    const { service, prisma } = setup(link());
    await expect(service.remove('kid', 'l1', NOW)).rejects.toThrow(new ForbiddenException('unlink_needs_viewer'));
    await service.remove('mum', 'l1', NOW);
    expect(prisma.account_links.delete).toHaveBeenCalledWith({ where: { id: 'l1' } });
  });

  it('a child can cancel a request that is still pending, and a 16+ sharer can unlink', async () => {
    const pending = setup(link({ status: LinkStatus.PENDING }));
    await pending.service.remove('kid', 'l1', NOW);
    expect(pending.prisma.account_links.delete).toHaveBeenCalled();
    const older = setup(link({ sharer_id: 'teen' }));
    await older.service.remove('teen', 'l1', NOW);
    expect(older.prisma.account_links.delete).toHaveBeenCalled();
  });

  it('is not found for someone outside the link', async () => {
    const { service } = setup(link());
    await expect(service.remove('aunt', 'l1', NOW)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('LinksService.updateShares', () => {
  it('under 16, sharing less waits for the viewer while sharing more applies at once', async () => {
    const { service, prisma } = setup(link());
    await service.updateShares('kid', 'l1', [LinkShare.POSTS, LinkShare.FOLLOWS], NOW);
    expect(prisma.account_links.update).toHaveBeenCalledWith({
      where: { id: 'l1' },
      data: {
        shares: [LinkShare.POSTS, LinkShare.MESSAGES, LinkShare.FOLLOWS],
        requested_shares: [LinkShare.POSTS, LinkShare.FOLLOWS],
      },
    });
  });

  it('16+ changes apply straight away and the viewer is told', async () => {
    const { service, prisma, notifications } = setup(link({ sharer_id: 'teen' }));
    await service.updateShares('teen', 'l1', [LinkShare.POSTS], NOW);
    expect(prisma.account_links.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { shares: [LinkShare.POSTS], requested_shares: [] } });
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ recipientId: 'mum', note: 'changed what they share with you' }));
  });

  it('the viewer approves a waiting change', async () => {
    const { service, prisma } = setup(link({ requested_shares: [LinkShare.POSTS] }));
    await service.reviewChange('mum', 'l1', true);
    expect(prisma.account_links.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { shares: [LinkShare.POSTS], requested_shares: [] } });
  });
});

describe('LinksService stay question at 16', () => {
  const linkedAt15 = link({ sharer_id: 'teen', accepted_at: new Date('2024-12-01T00:00:00.000Z') });

  it('asks a sharer who linked under 16 and is now 16, once', async () => {
    const { service, prisma } = setup(linkedAt15);
    prisma.account_links.findUnique.mockResolvedValue(linkedAt15);
    await service.answerStay('teen', 'l1', true, NOW);
    expect(prisma.account_links.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { stay_answered_at: NOW } });

    const answered = setup({ ...linkedAt15, stay_answered_at: NOW });
    await expect(answered.service.answerStay('teen', 'l1', false, NOW)).rejects.toThrow(new BadRequestException('no_stay_question'));
  });

  it('unlinks when they say no', async () => {
    const { service, prisma } = setup(linkedAt15);
    await service.answerStay('teen', 'l1', false, NOW);
    expect(prisma.account_links.delete).toHaveBeenCalledWith({ where: { id: 'l1' } });
  });
});

describe('LinksService.linkFromConsent', () => {
  it('creates an active link sharing everything but messages', async () => {
    const { service, prisma } = setup(null);
    await service.linkFromConsent('mum', 'kid', NOW);
    expect(prisma.account_links.create).toHaveBeenCalledWith({
      data: { sharer_id: 'kid', viewer_id: 'mum', shares: CONSENT_LINK_SHARES, status: LinkStatus.ACTIVE, accepted_at: NOW },
    });
    expect(CONSENT_LINK_SHARES).not.toContain(LinkShare.MESSAGES);
  });
});

describe('LinksService.activity', () => {
  it("shows only the child's own messages, with the other person as a username", async () => {
    const { service, prisma } = setup(link({ shares: [LinkShare.MESSAGES] }));
    prisma.messages.findMany.mockResolvedValue([
      {
        id: 'm1',
        content: 'see you at the match',
        created_at: NOW,
        conversation: { user_a: { id: 'kid', username: 'kid' }, user_b: { id: 'pal', username: 'pal' } },
      },
    ]);
    const { items } = await service.activity('mum', 'l1');
    expect(prisma.messages.findMany.mock.calls[0][0].where).toEqual({ sender_id: 'kid', created_at: undefined });
    expect(items).toEqual([
      { kind: 'MESSAGE', id: 'm1', createdAt: NOW, text: 'see you at the match', postId: null, other: { id: 'pal', username: 'pal' } },
    ]);
    expect(prisma.posts.findMany).not.toHaveBeenCalled();
    expect(prisma.follows.findMany).not.toHaveBeenCalled();
  });

  it('is only for the viewer of an active link', async () => {
    const { service } = setup(link());
    await expect(service.activity('kid', 'l1')).rejects.toBeInstanceOf(NotFoundException);
    const pending = setup(link({ status: LinkStatus.PENDING }));
    await expect(pending.service.activity('mum', 'l1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
