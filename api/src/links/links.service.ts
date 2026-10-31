import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LinkShare, LinkStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ModerationService } from '../moderation/moderation.service';
import { calculateAge } from '../users/age-tier.util';

const VIEWER_MIN_AGE = 18;
// Under this age a sharer cannot unlink or quietly share less; the viewer decides.
const SHARER_INDEPENDENT_AGE = 16;
const MAX_VIEWERS_UNDER_16 = 2;
const ACTIVITY_PAGE = 30;

// What a parent or guardian gets when linking while approving consent (7a): everything public
// the child does. Messages are the child's own choice, from Settings.
export const CONSENT_LINK_SHARES: LinkShare[] = [LinkShare.POSTS, LinkShare.REPLIES, LinkShare.REPOSTS, LinkShare.QUOTES, LinkShare.FOLLOWS];

type Person = { id: string; username: string; display_name: string; profile_image_url: string | null };
const personSelect = { id: true, username: true, display_name: true, profile_image_url: true } as const;

export type LinkView = {
  id: string;
  role: 'sharer' | 'viewer';
  status: LinkStatus;
  shares: LinkShare[];
  requestedShares: LinkShare[];
  other: { id: string; username: string; displayName: string; avatarUrl: string | null };
  canUnlink: boolean;
  needsStayAnswer: boolean;
  createdAt: Date;
};

export type LinkActivityItem = {
  kind: 'POST' | 'REPLY' | 'QUOTE' | 'REPOST' | 'FOLLOW' | 'MESSAGE';
  id: string;
  createdAt: Date;
  text: string | null;
  postId: string | null;
  // Whose post was replied to, quoted or reposted; who was followed or messaged.
  other: { id: string; username: string } | null;
};

function cleanShares(shares: LinkShare[]): LinkShare[] {
  const set = Array.from(new Set(shares));
  if (!set.length) throw new BadRequestException('link_shares_required');
  return set;
}

@Injectable()
export class LinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly moderation: ModerationService,
  ) {}

  async list(userId: string, now: Date = new Date()): Promise<LinkView[]> {
    const me = await this.requireUser(userId);
    const rows = await this.prisma.account_links.findMany({
      where: { OR: [{ sharer_id: userId }, { viewer_id: userId }] },
      orderBy: { created_at: 'desc' },
      include: { sharer: { select: personSelect }, viewer: { select: personSelect } },
    });
    return rows.map((r) => {
      const role = r.sharer_id === userId ? 'sharer' : 'viewer';
      const other: Person = role === 'sharer' ? r.viewer : r.sharer;
      return {
        id: r.id,
        role,
        status: r.status,
        shares: r.shares,
        requestedShares: r.requested_shares,
        other: { id: other.id, username: other.username, displayName: other.display_name, avatarUrl: other.profile_image_url },
        canUnlink: role === 'viewer' || r.status === LinkStatus.PENDING || calculateAge(me.date_of_birth, now) >= SHARER_INDEPENDENT_AGE,
        needsStayAnswer: role === 'sharer' && this.needsStayAnswer(r, me.date_of_birth, now),
        createdAt: r.created_at,
      };
    });
  }

  // The sharer asks; the viewer must be 18+. Because the requester is always the one sharing,
  // an adult can never start a link that shows them a child's activity.
  async request(sharerId: string, viewerId: string, shares: LinkShare[], now: Date = new Date()): Promise<{ id: string }> {
    if (sharerId === viewerId) throw new BadRequestException('cannot_link_self');
    const [sharer, viewer] = await Promise.all([this.requireUser(sharerId), this.prisma.users.findUnique({ where: { id: viewerId } })]);
    if (!viewer) throw new NotFoundException('user_not_found');
    if (calculateAge(viewer.date_of_birth, now) < VIEWER_MIN_AGE) throw new BadRequestException('link_viewer_too_young');
    await this.moderation.assertCanInteract(sharerId, viewerId);
    await this.assertRoomForViewer(sharer, now);

    try {
      const link = await this.prisma.account_links.create({
        data: { sharer_id: sharerId, viewer_id: viewerId, shares: cleanShares(shares) },
        select: { id: true },
      });
      void this.tell(viewerId, sharerId, 'wants to link their account to yours');
      return link;
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('link_exists');
      throw e;
    }
  }

  // 7a: a parent or guardian approving consent in the app may link straight away.
  async linkFromConsent(viewerId: string, childId: string, now: Date = new Date()) {
    const child = await this.requireUser(childId);
    const existing = await this.prisma.account_links.findUnique({
      where: { sharer_id_viewer_id: { sharer_id: childId, viewer_id: viewerId } },
    });
    if (existing) {
      if (existing.status === LinkStatus.PENDING) {
        await this.prisma.account_links.update({ where: { id: existing.id }, data: { status: LinkStatus.ACTIVE, accepted_at: now } });
      }
      return;
    }
    await this.assertRoomForViewer(child, now);
    await this.prisma.account_links.create({
      data: { sharer_id: childId, viewer_id: viewerId, shares: CONSENT_LINK_SHARES, status: LinkStatus.ACTIVE, accepted_at: now },
    });
  }

  async accept(viewerId: string, linkId: string, now: Date = new Date()) {
    const link = await this.requireLink(linkId, viewerId, 'viewer');
    if (link.status !== LinkStatus.PENDING) throw new BadRequestException('link_not_pending');
    const viewer = await this.requireUser(viewerId);
    if (calculateAge(viewer.date_of_birth, now) < VIEWER_MIN_AGE) throw new BadRequestException('link_viewer_too_young');
    await this.prisma.account_links.update({ where: { id: linkId }, data: { status: LinkStatus.ACTIVE, accepted_at: now } });
    void this.tell(link.sharer_id, viewerId, 'accepted your link request');
  }

  // Declining a request, cancelling one, or ending a link. A sharer under 16 can't end an
  // active link; only the viewer can.
  async remove(userId: string, linkId: string, now: Date = new Date()) {
    const link = await this.requireLink(linkId, userId);
    if (link.sharer_id === userId && link.status === LinkStatus.ACTIVE) {
      const me = await this.requireUser(userId);
      if (calculateAge(me.date_of_birth, now) < SHARER_INDEPENDENT_AGE) throw new ForbiddenException('unlink_needs_viewer');
    }
    await this.prisma.account_links.delete({ where: { id: linkId } });
    const otherId = link.sharer_id === userId ? link.viewer_id : link.sharer_id;
    if (link.status === LinkStatus.ACTIVE) void this.tell(otherId, userId, 'unlinked your accounts');
  }

  // Sharing more always applies at once. Under 16, sharing less waits for the viewer.
  async updateShares(sharerId: string, linkId: string, shares: LinkShare[], now: Date = new Date()) {
    const link = await this.requireLink(linkId, sharerId, 'sharer');
    const next = cleanShares(shares);
    if (link.status === LinkStatus.PENDING) {
      await this.prisma.account_links.update({ where: { id: linkId }, data: { shares: next } });
      return;
    }
    const me = await this.requireUser(sharerId);
    const dropping = link.shares.some((s) => !next.includes(s));
    if (calculateAge(me.date_of_birth, now) < SHARER_INDEPENDENT_AGE && dropping) {
      const widened = Array.from(new Set([...link.shares, ...next]));
      await this.prisma.account_links.update({ where: { id: linkId }, data: { shares: widened, requested_shares: next } });
      void this.tell(link.viewer_id, sharerId, 'asked to share less with you');
      return;
    }
    await this.prisma.account_links.update({ where: { id: linkId }, data: { shares: next, requested_shares: [] } });
    void this.tell(link.viewer_id, sharerId, 'changed what they share with you');
  }

  async reviewChange(viewerId: string, linkId: string, approve: boolean) {
    const link = await this.requireLink(linkId, viewerId, 'viewer');
    if (!link.requested_shares.length) throw new BadRequestException('no_change_requested');
    await this.prisma.account_links.update({
      where: { id: linkId },
      data: approve ? { shares: link.requested_shares, requested_shares: [] } : { requested_shares: [] },
    });
    void this.tell(link.sharer_id, viewerId, approve ? 'approved your change to what you share' : 'kept what you share the same');
  }

  // The "Stay linked?" question for a sharer who linked under 16 and is now 16.
  async answerStay(sharerId: string, linkId: string, stay: boolean, now: Date = new Date()) {
    const link = await this.requireLink(linkId, sharerId, 'sharer');
    const me = await this.requireUser(sharerId);
    if (!this.needsStayAnswer(link, me.date_of_birth, now)) throw new BadRequestException('no_stay_question');
    if (stay) {
      await this.prisma.account_links.update({ where: { id: linkId }, data: { stay_answered_at: now } });
    } else {
      await this.prisma.account_links.delete({ where: { id: linkId } });
      void this.tell(link.viewer_id, sharerId, 'unlinked your accounts');
    }
  }

  // The viewer's timeline of what the sharer chose to share, newest first.
  async activity(viewerId: string, linkId: string, before?: Date): Promise<{ items: LinkActivityItem[]; nextCursor: string | null }> {
    const link = await this.requireLink(linkId, viewerId, 'viewer');
    if (link.status !== LinkStatus.ACTIVE) throw new NotFoundException('link_not_found');
    const sharerId = link.sharer_id;
    const shares = new Set(link.shares);
    const createdAt = before ? { lt: before } : undefined;
    const take = ACTIVITY_PAGE;

    const kinds: { share: LinkShare; where: object }[] = [
      { share: LinkShare.POSTS, where: { parent_post_id: null, quoted_post_id: null, repost_of_id: null } },
      { share: LinkShare.REPLIES, where: { parent_post_id: { not: null } } },
      { share: LinkShare.QUOTES, where: { parent_post_id: null, quoted_post_id: { not: null } } },
      { share: LinkShare.REPOSTS, where: { repost_of_id: { not: null } } },
    ];
    const postKinds = kinds.filter((k) => shares.has(k.share));
    const owner = { select: { id: true, username: true } };

    const [posts, follows, messages] = await Promise.all([
      postKinds.length
        ? this.prisma.posts.findMany({
            where: { author_id: sharerId, deleted_at: null, created_at: createdAt, OR: postKinds.map((k) => k.where) },
            orderBy: { created_at: 'desc' },
            take,
            select: {
              id: true,
              content: true,
              created_at: true,
              parent_post_id: true,
              quoted_post_id: true,
              repost_of_id: true,
              posts: { select: { users: owner } },
              quoted_post: { select: { users: owner } },
              repost_of: { select: { id: true, content: true, users: owner } },
            },
          })
        : [],
      shares.has(LinkShare.FOLLOWS)
        ? this.prisma.follows.findMany({
            where: { follower_id: sharerId, created_at: createdAt },
            orderBy: { created_at: 'desc' },
            take,
            select: { created_at: true, users_follows_following_idTousers: owner },
          })
        : [],
      shares.has(LinkShare.MESSAGES)
        ? this.prisma.messages.findMany({
            where: { sender_id: sharerId, created_at: createdAt },
            orderBy: { created_at: 'desc' },
            take,
            select: { id: true, content: true, created_at: true, conversation: { select: { user_a: owner, user_b: owner } } },
          })
        : [],
    ]);

    const items: LinkActivityItem[] = [
      ...posts.map((p): LinkActivityItem => {
        if (p.repost_of_id) {
          return { kind: 'REPOST', id: p.id, createdAt: p.created_at, text: p.repost_of?.content ?? null, postId: p.repost_of?.id ?? null, other: p.repost_of?.users ?? null };
        }
        if (p.parent_post_id) {
          return { kind: 'REPLY', id: p.id, createdAt: p.created_at, text: p.content, postId: p.id, other: p.posts?.users ?? null };
        }
        if (p.quoted_post_id) {
          return { kind: 'QUOTE', id: p.id, createdAt: p.created_at, text: p.content, postId: p.id, other: p.quoted_post?.users ?? null };
        }
        return { kind: 'POST', id: p.id, createdAt: p.created_at, text: p.content, postId: p.id, other: null };
      }),
      ...follows.map((f): LinkActivityItem => ({
        kind: 'FOLLOW',
        id: `follow-${f.users_follows_following_idTousers.id}`,
        createdAt: f.created_at,
        text: null,
        postId: null,
        other: f.users_follows_following_idTousers,
      })),
      // Only the sharer's own words; the other person shows as a username, never their messages.
      ...messages.map((m): LinkActivityItem => ({
        kind: 'MESSAGE',
        id: m.id,
        createdAt: m.created_at,
        text: m.content,
        postId: null,
        other: m.conversation.user_a.id === sharerId ? m.conversation.user_b : m.conversation.user_a,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, take);

    return { items, nextCursor: items.length === take ? items[items.length - 1].createdAt.toISOString() : null };
  }

  // ---- Internals -----------------------------------------------------------

  private needsStayAnswer(link: { status: LinkStatus; accepted_at: Date | null; stay_answered_at: Date | null }, dob: Date, now: Date) {
    return (
      link.status === LinkStatus.ACTIVE &&
      !link.stay_answered_at &&
      !!link.accepted_at &&
      calculateAge(dob, link.accepted_at) < SHARER_INDEPENDENT_AGE &&
      calculateAge(dob, now) >= SHARER_INDEPENDENT_AGE
    );
  }

  private async assertRoomForViewer(sharer: { id: string; date_of_birth: Date }, now: Date) {
    if (calculateAge(sharer.date_of_birth, now) >= SHARER_INDEPENDENT_AGE) return;
    const count = await this.prisma.account_links.count({ where: { sharer_id: sharer.id } });
    if (count >= MAX_VIEWERS_UNDER_16) throw new BadRequestException('link_limit_reached');
  }

  private async requireUser(id: string) {
    const user = await this.prisma.users.findUnique({ where: { id }, select: { id: true, date_of_birth: true } });
    if (!user) throw new NotFoundException('user_not_found');
    return user;
  }

  // A link the caller is part of (in the given role, if one is named); anything else is not found.
  private async requireLink(linkId: string, userId: string, role?: 'sharer' | 'viewer') {
    const link = await this.prisma.account_links.findUnique({ where: { id: linkId } });
    const isSharer = link?.sharer_id === userId;
    const isViewer = link?.viewer_id === userId;
    if (!link || (role === 'sharer' ? !isSharer : role === 'viewer' ? !isViewer : !isSharer && !isViewer)) {
      throw new NotFoundException('link_not_found');
    }
    return link;
  }

  private tell(recipientId: string, actorId: string, note: string) {
    return this.notifications.notify({ recipientId, actorId, type: 'LINK', note });
  }
}
