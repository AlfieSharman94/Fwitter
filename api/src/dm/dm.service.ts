import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { PushService } from '../notifications/push.service';

const userSelect = {
  id: true,
  username: true,
  display_name: true,
  profile_image_url: true,
  verified_at: true,
  age_tier: true,
  banned_at: true,
} as const;

const convSelect = {
  id: true,
  user_a_id: true,
  user_b_id: true,
  last_message_at: true,
  last_message_preview: true,
  a_last_read_at: true,
  b_last_read_at: true,
  user_a: { select: userSelect },
  user_b: { select: userSelect },
} as const;

type Conv = {
  id: string;
  user_a_id: string;
  user_b_id: string;
  last_message_at: Date | null;
  last_message_preview: string | null;
  a_last_read_at: Date | null;
  b_last_read_at: Date | null;
  user_a: Participant;
  user_b: Participant;
};
type Participant = {
  id: string;
  username: string;
  display_name: string;
  profile_image_url: string | null;
  verified_at: Date | null;
  age_tier: string;
  banned_at: Date | null;
};

export type DmReason = 'self' | 'user_not_found' | 'unavailable' | 'blocked' | 'age_tier' | 'not_mutual';

// Who may message whom, and the conversations themselves. The rule for an under-16
// audience: only people who follow each other, in the same age tier, with no block
// between them. It is checked again on every send, so a lapsed follow makes an
// existing conversation read-only.
@Injectable()
export class DmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
    private readonly push: PushService,
  ) {}

  async eligibility(viewerId: string, otherId: string): Promise<{ allowed: boolean; reason: DmReason | null }> {
    if (viewerId === otherId) return { allowed: false, reason: 'self' };
    const [viewer, other] = await Promise.all([
      this.prisma.users.findUnique({ where: { id: viewerId }, select: { age_tier: true } }),
      this.prisma.users.findUnique({ where: { id: otherId }, select: { age_tier: true, banned_at: true } }),
    ]);
    if (!viewer || !other) return { allowed: false, reason: 'user_not_found' };
    if (other.banned_at) return { allowed: false, reason: 'unavailable' };
    if (await this.moderation.isBlockedEitherWay(viewerId, otherId)) return { allowed: false, reason: 'blocked' };
    if (viewer.age_tier !== other.age_tier) return { allowed: false, reason: 'age_tier' };
    const follows = await this.prisma.follows.count({
      where: {
        OR: [
          { follower_id: viewerId, following_id: otherId },
          { follower_id: otherId, following_id: viewerId },
        ],
      },
    });
    if (follows < 2) return { allowed: false, reason: 'not_mutual' };
    return { allowed: true, reason: null };
  }

  private async assertCanMessage(viewerId: string, otherId: string) {
    const e = await this.eligibility(viewerId, otherId);
    if (!e.allowed) throw new ForbiddenException(`dm_${e.reason}`);
  }

  // Both orders map to one row.
  private pair(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }

  private other(c: Conv, viewerId: string): Participant {
    return c.user_a_id === viewerId ? c.user_b : c.user_a;
  }

  private myLastRead(c: Conv, viewerId: string) {
    return c.user_a_id === viewerId ? c.a_last_read_at : c.b_last_read_at;
  }

  private async unreadIn(c: Conv, viewerId: string) {
    const since = this.myLastRead(c, viewerId);
    return this.prisma.messages.count({
      where: {
        conversation_id: c.id,
        sender_id: { not: viewerId },
        ...(since ? { created_at: { gt: since } } : {}),
      },
    });
  }

  private shape(c: Conv, viewerId: string, unread: number, canMessage: boolean, reason: DmReason | null) {
    const o = this.other(c, viewerId);
    return {
      id: c.id,
      other: { id: o.id, username: o.username, display_name: o.display_name, profile_image_url: o.profile_image_url, verified_at: o.verified_at },
      last_message_at: c.last_message_at,
      last_message_preview: c.last_message_preview,
      unread,
      can_message: canMessage,
      reason,
    };
  }

  private async requireConversation(viewerId: string, id: string): Promise<Conv> {
    const c = await this.prisma.conversations.findUnique({ where: { id }, select: convSelect });
    if (!c || (c.user_a_id !== viewerId && c.user_b_id !== viewerId)) throw new NotFoundException('conversation_not_found');
    return c;
  }

  async open(viewerId: string, otherId: string) {
    await this.assertCanMessage(viewerId, otherId);
    const [a, b] = this.pair(viewerId, otherId);
    const c = await this.prisma.conversations.upsert({
      where: { user_a_id_user_b_id: { user_a_id: a, user_b_id: b } },
      create: { user_a_id: a, user_b_id: b },
      update: {},
      select: convSelect,
    });
    return { conversation: this.shape(c, viewerId, await this.unreadIn(c, viewerId), true, null) };
  }

  // Inbox: conversations with at least one message, newest activity first.
  async list(viewerId: string) {
    const rows = await this.prisma.conversations.findMany({
      where: { OR: [{ user_a_id: viewerId }, { user_b_id: viewerId }], last_message_at: { not: null } },
      orderBy: { last_message_at: 'desc' },
      take: 50,
      select: convSelect,
    });
    const conversations = await Promise.all(
      rows.map(async (c) => {
        const [unread, elig] = await Promise.all([this.unreadIn(c, viewerId), this.eligibility(viewerId, this.other(c, viewerId).id)]);
        return this.shape(c, viewerId, unread, elig.allowed, elig.reason);
      }),
    );
    return { conversations };
  }

  async unreadTotal(viewerId: string) {
    const rows = await this.prisma.conversations.findMany({
      where: { OR: [{ user_a_id: viewerId }, { user_b_id: viewerId }], last_message_at: { not: null } },
      select: convSelect,
    });
    const counts = await Promise.all(rows.map((c) => this.unreadIn(c, viewerId)));
    return { count: counts.reduce((a, b) => a + b, 0) };
  }

  // Newest first for cursor paging; the client reverses for display. Opening the
  // first page marks the conversation read for the viewer.
  async messages(viewerId: string, id: string, cursor?: string, limit = 30) {
    const c = await this.requireConversation(viewerId, id);
    const createdBefore = cursor ? new Date(cursor) : undefined;
    if (createdBefore && Number.isNaN(createdBefore.getTime())) throw new BadRequestException('invalid_cursor');

    const rows = await this.prisma.messages.findMany({
      where: { conversation_id: id, ...(createdBefore ? { created_at: { lt: createdBefore } } : {}) },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: { id: true, sender_id: true, content: true, created_at: true },
    });

    if (!cursor) {
      await this.prisma.conversations.update({
        where: { id },
        data: c.user_a_id === viewerId ? { a_last_read_at: new Date() } : { b_last_read_at: new Date() },
      });
    }

    const elig = await this.eligibility(viewerId, this.other(c, viewerId).id);
    const nextCursor = rows.length === limit ? rows[rows.length - 1].created_at.toISOString() : null;
    return {
      conversation: this.shape(c, viewerId, 0, elig.allowed, elig.reason),
      messages: rows,
      nextCursor,
    };
  }

  async send(viewerId: string, id: string, rawContent: string) {
    const c = await this.requireConversation(viewerId, id);
    const other = this.other(c, viewerId);
    await this.assertCanMessage(viewerId, other.id);

    const content = rawContent.trim();
    if (!content) throw new BadRequestException('content_required');
    await this.moderation.assertContentAllowed(content);

    const [message] = await this.prisma.$transaction([
      this.prisma.messages.create({
        data: { conversation_id: id, sender_id: viewerId, content },
        select: { id: true, sender_id: true, content: true, created_at: true },
      }),
      this.prisma.conversations.update({
        where: { id },
        data: {
          last_message_at: new Date(),
          last_message_preview: content.slice(0, 120),
          // Sending counts as having read everything so far.
          ...(c.user_a_id === viewerId ? { a_last_read_at: new Date() } : { b_last_read_at: new Date() }),
        },
      }),
    ]);

    const sender = c.user_a_id === viewerId ? c.user_a : c.user_b;
    void this.push.sendToUser(other.id, {
      title: sender.display_name,
      body: content.length > 100 ? `${content.slice(0, 97)}…` : content,
      data: { url: `/dm/${id}`, type: 'MESSAGE' },
    });

    return { message };
  }

  // Moderators may read a conversation only once someone in it has reported it.
  async adminMessages(id: string) {
    const c = await this.prisma.conversations.findUnique({
      where: { id },
      select: { ...convSelect, _count: { select: { reports: true } } },
    });
    if (!c) throw new NotFoundException('conversation_not_found');
    if (c._count.reports === 0) throw new ForbiddenException('conversation_not_reported');
    const messages = await this.prisma.messages.findMany({
      where: { conversation_id: id },
      orderBy: { created_at: 'asc' },
      take: 500,
      select: { id: true, sender_id: true, content: true, created_at: true },
    });
    const pick = (u: Participant) => ({ id: u.id, username: u.username, display_name: u.display_name });
    return { participants: [pick(c.user_a), pick(c.user_b)], messages };
  }
}
