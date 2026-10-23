import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AgeTier, Prisma, ReportReason, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildBannedPattern, containsBannedWord } from './banned-words';
import { canSeeUser, visibleUsersWhere } from '../users/age-tier.util';

// Reports from this many distinct accounts hide a post until a moderator looks at it.
export const AUTO_HIDE_REPORTS = 3;
const BANNED_WORDS_TTL_MS = 60_000;
const STATUS_TTL_MS = 30_000;

export type AccountStatus = {
  at: number;
  id: string | null;
  role: Role;
  suspended_until: Date | null;
  banned_at: Date | null;
};

export type ReportInput = {
  postId?: string;
  userId?: string;
  conversationId?: string;
  reason: ReportReason;
  details?: string;
};

@Injectable()
export class ModerationService {
  private bannedPattern: RegExp | null = null;
  private bannedLoadedAt = 0;
  private readonly statusCache = new Map<string, AccountStatus>();

  constructor(private readonly prisma: PrismaService) {}

  // ---- Account status (role, suspension, ban) -----------------------------

  // Looked up on every authenticated request, so it's cached for a short while.
  // A moderator action calls invalidateStatus so the change applies within seconds.
  async accountStatus(sub: string): Promise<AccountStatus> {
    const hit = this.statusCache.get(sub);
    if (hit && Date.now() - hit.at < STATUS_TTL_MS) return hit;

    const u = await this.prisma.users.findUnique({
      where: { cognito_sub: sub },
      select: { id: true, role: true, suspended_until: true, banned_at: true },
    });
    const entry: AccountStatus = {
      at: Date.now(),
      id: u?.id ?? null,
      role: u?.role ?? Role.USER,
      suspended_until: u?.suspended_until ?? null,
      banned_at: u?.banned_at ?? null,
    };
    this.statusCache.set(sub, entry);
    return entry;
  }

  invalidateStatus(userId: string) {
    for (const [sub, entry] of this.statusCache) {
      if (entry.id === userId) this.statusCache.delete(sub);
    }
  }

  // Drops the whole cache; only needed when the user lookup itself changes (tests, deletes).
  clearStatusCache() {
    this.statusCache.clear();
  }

  async assertActive(sub: string) {
    const status = await this.accountStatus(sub);
    if (status.banned_at) throw new ForbiddenException({ message: 'account_banned' });
    if (status.suspended_until && status.suspended_until.getTime() > Date.now()) {
      throw new ForbiddenException({ message: 'account_suspended', until: status.suspended_until.toISOString() });
    }
  }

  // Called by the admin service after it edits the banned-words table.
  invalidateBannedWords() {
    this.bannedLoadedAt = 0;
  }

  // ---- Blocks -------------------------------------------------------------

  // Everyone the viewer has blocked plus everyone who has blocked the viewer.
  async blockedIds(viewerId: string): Promise<string[]> {
    const rows = await this.prisma.blocks.findMany({
      where: { OR: [{ blocker_id: viewerId }, { blocked_id: viewerId }] },
      select: { blocker_id: true, blocked_id: true },
    });
    return rows.map((r) => (r.blocker_id === viewerId ? r.blocked_id : r.blocker_id));
  }

  async isBlockedEitherWay(a: string, b: string): Promise<boolean> {
    if (a === b) return false;
    const row = await this.prisma.blocks.findFirst({
      where: {
        OR: [
          { blocker_id: a, blocked_id: b },
          { blocker_id: b, blocked_id: a },
        ],
      },
      select: { blocker_id: true },
    });
    return !!row;
  }

  // Replying to, quoting, liking, reposting or following across a block is refused.
  async assertCanInteract(viewerId: string, otherId: string) {
    if (await this.isBlockedEitherWay(viewerId, otherId)) throw new ForbiddenException('blocked');
  }

  async block(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) throw new BadRequestException('cannot_block_self');
    const target = await this.prisma.users.findUnique({ where: { id: blockedId }, select: { id: true } });
    if (!target) throw new NotFoundException('user_not_found');

    await this.prisma.$transaction([
      this.prisma.blocks.createMany({ data: [{ blocker_id: blockerId, blocked_id: blockedId }], skipDuplicates: true }),
      // Blocking severs the relationship in both directions.
      this.prisma.follows.deleteMany({
        where: {
          OR: [
            { follower_id: blockerId, following_id: blockedId },
            { follower_id: blockedId, following_id: blockerId },
          ],
        },
      }),
    ]);
    return { blocked: true };
  }

  async unblock(blockerId: string, blockedId: string) {
    await this.prisma.blocks.deleteMany({ where: { blocker_id: blockerId, blocked_id: blockedId } });
    return { blocked: false };
  }

  // ---- Age tiers ----------------------------------------------------------

  // The rule itself is canSeeUser in users/age-tier.util.ts. Services only know the viewer's
  // db id, so the tier is one primary-key read; an unknown viewer counts as STANDARD, the
  // side that sees less.
  async viewerTier(viewerId: string): Promise<AgeTier> {
    const u = await this.prisma.users.findUnique({ where: { id: viewerId }, select: { age_tier: true } });
    return u?.age_tier ?? AgeTier.STANDARD;
  }

  // Users rows the viewer may see (search, follower lists, mentions); null means everyone.
  async usersVisibleTo(viewerId: string): Promise<Prisma.usersWhereInput | null> {
    return visibleUsersWhere(await this.viewerTier(viewerId));
  }

  async isUserVisible(viewerId: string, targetId: string): Promise<boolean> {
    const [tier, target] = await Promise.all([
      this.viewerTier(viewerId),
      this.prisma.users.findUnique({ where: { id: targetId }, select: { age_tier: true, public_profile: true } }),
    ]);
    return !!target && canSeeUser(tier, target);
  }

  // For user reads and follows: a private JUNIOR looks like it doesn't exist to a STANDARD viewer.
  async assertUserVisible(viewerId: string, targetId: string) {
    if (!(await this.isUserVisible(viewerId, targetId))) throw new NotFoundException('user_not_found');
  }

  // ---- Visibility ---------------------------------------------------------

  // Prisma `where` fragment every post query spreads in: no posts from either side of a
  // block, no hidden posts unless they're the viewer's own, and for a STANDARD viewer no
  // posts by a private JUNIOR, including the originals inside quote and repost embeds.
  visibilityWhere(viewerId: string, blockedIds: string[], viewerTier: AgeTier): Prisma.postsWhereInput {
    const author = visibleUsersWhere(viewerTier);
    return {
      AND: [
        ...(blockedIds.length ? [{ author_id: { notIn: blockedIds } }] : []),
        { OR: [{ hidden_at: null }, { author_id: viewerId }] },
        ...(author
          ? [
              { users: author },
              { OR: [{ quoted_post_id: null }, { quoted_post: { users: author } }] },
              { OR: [{ repost_of_id: null }, { repost_of: { users: author } }] },
            ]
          : []),
      ],
    };
  }

  async visibility(viewerId: string): Promise<Prisma.postsWhereInput> {
    const [blocked, tier] = await Promise.all([this.blockedIds(viewerId), this.viewerTier(viewerId)]);
    return this.visibilityWhere(viewerId, blocked, tier);
  }

  // For single-post reads: hidden posts, posts across a block and posts by a JUNIOR the viewer
  // cannot see look like they don't exist.
  async assertVisible(viewerId: string, post: { author_id: string; hidden_at: Date | null }) {
    if (post.author_id === viewerId) return;
    if (post.hidden_at) throw new NotFoundException('post_not_found');
    if (await this.isBlockedEitherWay(viewerId, post.author_id)) throw new NotFoundException('post_not_found');
    if (!(await this.isUserVisible(viewerId, post.author_id))) throw new NotFoundException('post_not_found');
  }

  // ---- Banned words -------------------------------------------------------

  private async bannedWordsPattern(): Promise<RegExp | null> {
    if (Date.now() - this.bannedLoadedAt > BANNED_WORDS_TTL_MS) {
      const rows = await this.prisma.banned_words.findMany({ select: { word: true } });
      this.bannedPattern = buildBannedPattern(rows.map((r) => r.word));
      this.bannedLoadedAt = Date.now();
    }
    return this.bannedPattern;
  }

  // Posts, bios and names go through here before being stored.
  async assertContentAllowed(...texts: (string | null | undefined)[]) {
    const pattern = await this.bannedWordsPattern();
    for (const text of texts) {
      if (text && containsBannedWord(text, pattern)) throw new BadRequestException('content_not_allowed');
    }
  }

  // ---- Reports ------------------------------------------------------------

  async report(reporterId: string, input: ReportInput): Promise<{ ok: true; hidden: boolean }> {
    const targets = [input.postId, input.userId, input.conversationId].filter(Boolean).length;
    if (targets !== 1) throw new BadRequestException('report_exactly_one_target');

    if (input.conversationId) {
      // Only a participant can report a conversation; moderators may then read it.
      const conv = await this.prisma.conversations.findUnique({
        where: { id: input.conversationId },
        select: { id: true, user_a_id: true, user_b_id: true },
      });
      if (!conv) throw new NotFoundException('conversation_not_found');
      if (conv.user_a_id !== reporterId && conv.user_b_id !== reporterId) throw new NotFoundException('conversation_not_found');
      await this.prisma.reports.createMany({
        data: [{ reporter_id: reporterId, conversation_id: conv.id, reason: input.reason, details: input.details ?? null }],
        skipDuplicates: true,
      });
      return { ok: true, hidden: false };
    }

    if (input.postId) {
      const post = await this.prisma.posts.findUnique({
        where: { id: input.postId },
        select: { id: true, author_id: true, hidden_at: true },
      });
      if (!post) throw new NotFoundException('post_not_found');
      if (post.author_id === reporterId) throw new BadRequestException('cannot_report_own_post');

      const hidden = await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.reports.createMany({
          data: [{ reporter_id: reporterId, post_id: post.id, reason: input.reason, details: input.details ?? null }],
          skipDuplicates: true, // one report per person per post
        });
        if (count === 0) return !!post.hidden_at;
        const updated = await tx.posts.update({
          where: { id: post.id },
          data: { report_count: { increment: 1 } },
          select: { report_count: true, hidden_at: true },
        });
        if (!updated.hidden_at && updated.report_count >= AUTO_HIDE_REPORTS) {
          await tx.posts.update({
            where: { id: post.id },
            data: { hidden_at: new Date(), hidden_reason: 'reports' },
          });
          return true;
        }
        return !!updated.hidden_at;
      });
      return { ok: true, hidden };
    }

    const user = await this.prisma.users.findUnique({ where: { id: input.userId! }, select: { id: true } });
    if (!user) throw new NotFoundException('user_not_found');
    if (user.id === reporterId) throw new BadRequestException('cannot_report_self');
    await this.prisma.reports.createMany({
      data: [{ reporter_id: reporterId, user_id: user.id, reason: input.reason, details: input.details ?? null }],
      skipDuplicates: true,
    });
    return { ok: true, hidden: false };
  }
}
