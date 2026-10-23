import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ModerationAction, Prisma, ReportStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ModerationService } from '../moderation/moderation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { publicMediaUrl } from '../media/media-url';

type Actor = { id: string; role: Role };

const DAY_MS = 86_400_000;

// Everything a moderator can do. Each action writes an audit row; actions on a post
// or user also close that target's open reports, so the queue drains as work is done.
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
    private readonly notifications: NotificationsService,
  ) {}

  private log(
    actor: Actor,
    action: ModerationAction,
    target: { userId?: string | null; postId?: string | null; snapshot?: string | null },
    note?: string | null,
  ) {
    return this.prisma.moderation_actions.create({
      data: {
        actor_id: actor.id,
        action,
        target_user_id: target.userId ?? null,
        target_post_id: target.postId ?? null,
        post_snapshot: target.snapshot ?? null,
        note: note ?? null,
      },
    });
  }

  private closeReports(actor: Actor, where: Prisma.reportsWhereInput, status: ReportStatus) {
    return this.prisma.reports.updateMany({
      where: { ...where, status: 'OPEN' },
      data: { status, resolved_at: new Date(), resolved_by: actor.id },
    });
  }

  // ---- Reports queue ------------------------------------------------------

  async listReports(status: ReportStatus | 'ALL', cursor?: string, limit = 50) {
    const createdBefore = cursor ? new Date(cursor) : undefined;
    const rows = await this.prisma.reports.findMany({
      where: {
        ...(status === 'ALL' ? {} : { status }),
        ...(createdBefore ? { created_at: { lt: createdBefore } } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
        id: true,
        reason: true,
        details: true,
        status: true,
        created_at: true,
        resolved_at: true,
        reporter: { select: { id: true, username: true } },
        posts: {
          select: {
            id: true,
            content: true,
            created_at: true,
            hidden_at: true,
            hidden_reason: true,
            report_count: true,
            users: { select: { id: true, username: true, display_name: true } },
            media: { orderBy: { position: 'asc' }, select: { key: true } },
          },
        },
        reported: {
          select: { id: true, username: true, display_name: true, suspended_until: true, banned_at: true, role: true, verified_at: true },
        },
      },
    });
    const nextCursor = rows.length === limit ? rows[rows.length - 1].created_at.toISOString() : null;
    return {
      reports: rows.map(({ posts, reported, ...r }) => ({
        ...r,
        post: posts ? { ...posts, media: posts.media.map((m) => ({ url: publicMediaUrl(m.key) })) } : null,
        user: reported,
      })),
      nextCursor,
    };
  }

  async summary() {
    const [openReports, hiddenPosts, suspended, banned] = await Promise.all([
      this.prisma.reports.count({ where: { status: 'OPEN' } }),
      this.prisma.posts.count({ where: { hidden_at: { not: null } } }),
      this.prisma.users.count({ where: { suspended_until: { gt: new Date() } } }),
      this.prisma.users.count({ where: { banned_at: { not: null } } }),
    ]);
    return { openReports, hiddenPosts, suspended, banned };
  }

  // "No action needed": closes every open report on the same target as this one.
  async dismissReports(actor: Actor, reportId: string, note?: string) {
    const report = await this.prisma.reports.findUnique({
      where: { id: reportId },
      select: { post_id: true, user_id: true },
    });
    if (!report) throw new NotFoundException('report_not_found');

    const where = report.post_id ? { post_id: report.post_id } : { user_id: report.user_id };
    const { count } = await this.closeReports(actor, where, 'DISMISSED');
    await this.log(actor, 'DISMISS_REPORTS', { postId: report.post_id, userId: report.user_id }, note);
    return { ok: true, dismissed: count };
  }

  // ---- Posts --------------------------------------------------------------

  private async requirePost(id: string) {
    const post = await this.prisma.posts.findUnique({
      where: { id },
      select: { id: true, content: true, author_id: true, hidden_at: true },
    });
    if (!post) throw new NotFoundException('post_not_found');
    return post;
  }

  async hidePost(actor: Actor, id: string, note?: string) {
    const post = await this.requirePost(id);
    await this.prisma.posts.update({
      where: { id },
      data: { hidden_at: post.hidden_at ?? new Date(), hidden_reason: 'moderator' },
    });
    await this.closeReports(actor, { post_id: id }, 'RESOLVED');
    await this.log(actor, 'HIDE_POST', { postId: id, userId: post.author_id, snapshot: post.content }, note);
    return { ok: true };
  }

  async restorePost(actor: Actor, id: string, note?: string) {
    const post = await this.requirePost(id);
    await this.prisma.posts.update({
      where: { id },
      data: { hidden_at: null, hidden_reason: null, report_count: 0 },
    });
    await this.closeReports(actor, { post_id: id }, 'DISMISSED');
    await this.log(actor, 'RESTORE_POST', { postId: id, userId: post.author_id, snapshot: post.content }, note);
    return { ok: true };
  }

  async deletePost(actor: Actor, id: string, note?: string) {
    const post = await this.requirePost(id);
    // Reports on the post cascade away with it, so mark them first for the record.
    await this.closeReports(actor, { post_id: id }, 'RESOLVED');
    await this.log(actor, 'DELETE_POST', { postId: id, userId: post.author_id, snapshot: post.content }, note);
    await this.prisma.posts.delete({ where: { id } });
    return { ok: true };
  }

  // ---- Users --------------------------------------------------------------

  private async requireUser(id: string) {
    const user = await this.prisma.users.findUnique({
      where: { id },
      select: { id: true, role: true, suspended_until: true, banned_at: true },
    });
    if (!user) throw new NotFoundException('user_not_found');
    return user;
  }

  // Moderators can't act on admins or on each other; admins can act on anyone but themselves.
  private assertCanAct(actor: Actor, target: { id: string; role: Role }) {
    if (actor.id === target.id) throw new BadRequestException('cannot_act_on_self');
    if (actor.role !== 'ADMIN' && target.role !== 'USER') throw new BadRequestException('target_outranks_you');
  }

  async searchUsers(q: string, limit = 30) {
    const query = q.trim();
    const rows = await this.prisma.users.findMany({
      where: query
        ? {
            OR: [
              { username: { contains: query, mode: 'insensitive' } },
              { display_name: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {},
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
        id: true,
        username: true,
        display_name: true,
        email: true,
        role: true,
        age_tier: true,
        created_at: true,
        suspended_until: true,
        banned_at: true,
        verified_at: true,
        _count: { select: { reports_received: true, posts: true } },
      },
    });
    return rows.map(({ _count, ...u }) => ({ ...u, reports_received: _count.reports_received, posts: _count.posts }));
  }

  async userDetail(id: string) {
    const user = await this.prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        display_name: true,
        email: true,
        bio: true,
        role: true,
        age_tier: true,
        date_of_birth: true,
        created_at: true,
        suspended_until: true,
        banned_at: true,
        verified_at: true,
        posts: {
          where: { repost_of_id: null },
          orderBy: { created_at: 'desc' },
          take: 20,
          select: {
            id: true,
            content: true,
            created_at: true,
            hidden_at: true,
            hidden_reason: true,
            report_count: true,
            media: { orderBy: { position: 'asc' }, select: { key: true } },
          },
        },
        reports_received: {
          orderBy: { created_at: 'desc' },
          take: 20,
          select: { id: true, reason: true, details: true, status: true, created_at: true, reporter: { select: { username: true } } },
        },
        moderation_received: {
          orderBy: { created_at: 'desc' },
          take: 20,
          select: { id: true, action: true, note: true, created_at: true, actor: { select: { username: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException('user_not_found');
    return {
      ...user,
      posts: user.posts.map((p) => ({ ...p, media: p.media.map((m) => ({ url: publicMediaUrl(m.key) })) })),
    };
  }

  async warn(actor: Actor, id: string, note: string) {
    const user = await this.requireUser(id);
    this.assertCanAct(actor, user);
    await this.notifications.notify({ recipientId: id, actorId: actor.id, type: 'WARNING', note });
    await this.log(actor, 'WARN_USER', { userId: id }, note);
    return { ok: true };
  }

  async suspend(actor: Actor, id: string, days: number, note?: string) {
    const user = await this.requireUser(id);
    this.assertCanAct(actor, user);
    const until = new Date(Date.now() + days * DAY_MS);
    await this.prisma.users.update({ where: { id }, data: { suspended_until: until } });
    this.moderation.invalidateStatus(id);
    await this.closeReports(actor, { user_id: id }, 'RESOLVED');
    await this.log(actor, 'SUSPEND_USER', { userId: id }, note ? `${days}d: ${note}` : `${days}d`);
    return { ok: true, suspended_until: until };
  }

  async unsuspend(actor: Actor, id: string, note?: string) {
    const user = await this.requireUser(id);
    this.assertCanAct(actor, user);
    await this.prisma.users.update({ where: { id }, data: { suspended_until: null } });
    this.moderation.invalidateStatus(id);
    await this.log(actor, 'UNSUSPEND_USER', { userId: id }, note);
    return { ok: true };
  }

  // Admin only (enforced at the route). A banned account is refused on every request
  // and its devices stop receiving pushes.
  async ban(actor: Actor, id: string, note?: string) {
    const user = await this.requireUser(id);
    this.assertCanAct(actor, user);
    await this.prisma.$transaction([
      this.prisma.users.update({ where: { id }, data: { banned_at: user.banned_at ?? new Date(), suspended_until: null } }),
      this.prisma.push_tokens.deleteMany({ where: { user_id: id } }),
    ]);
    this.moderation.invalidateStatus(id);
    await this.closeReports(actor, { user_id: id }, 'RESOLVED');
    await this.log(actor, 'BAN_USER', { userId: id }, note);
    return { ok: true };
  }

  async unban(actor: Actor, id: string, note?: string) {
    const user = await this.requireUser(id);
    this.assertCanAct(actor, user);
    await this.prisma.users.update({ where: { id }, data: { banned_at: null } });
    this.moderation.invalidateStatus(id);
    await this.log(actor, 'UNBAN_USER', { userId: id }, note);
    return { ok: true };
  }

  // Admin only. The badge is editorial, so it has no side effects beyond the flag and the log.
  async setVerified(actor: Actor, id: string, verified: boolean) {
    await this.requireUser(id);
    await this.prisma.users.update({ where: { id }, data: { verified_at: verified ? new Date() : null } });
    await this.log(actor, verified ? 'VERIFY_USER' : 'UNVERIFY_USER', { userId: id });
    return { ok: true, verified };
  }

  async setRole(actor: Actor, id: string, role: Role) {
    const user = await this.requireUser(id);
    if (actor.id === user.id) throw new BadRequestException('cannot_act_on_self');
    await this.prisma.users.update({ where: { id }, data: { role } });
    this.moderation.invalidateStatus(id);
    await this.log(actor, 'SET_ROLE', { userId: id }, `${user.role} -> ${role}`);
    return { ok: true, role };
  }

  // ---- Banned words -------------------------------------------------------

  listBannedWords() {
    return this.prisma.banned_words.findMany({ orderBy: { word: 'asc' } });
  }

  async addBannedWord(actor: Actor, raw: string) {
    const word = raw.trim().toLowerCase();
    if (!word) throw new BadRequestException('word_required');
    await this.prisma.banned_words.createMany({ data: [{ word }], skipDuplicates: true });
    this.moderation.invalidateBannedWords();
    await this.log(actor, 'ADD_BANNED_WORD', {}, word);
    return { ok: true, word };
  }

  async removeBannedWord(actor: Actor, raw: string) {
    const word = raw.trim().toLowerCase();
    const { count } = await this.prisma.banned_words.deleteMany({ where: { word } });
    if (count === 0) throw new NotFoundException('word_not_found');
    this.moderation.invalidateBannedWords();
    await this.log(actor, 'REMOVE_BANNED_WORD', {}, word);
    return { ok: true };
  }

  // ---- Audit log ----------------------------------------------------------

  async listActions(cursor?: string, limit = 50) {
    const createdBefore = cursor ? new Date(cursor) : undefined;
    const rows = await this.prisma.moderation_actions.findMany({
      where: createdBefore ? { created_at: { lt: createdBefore } } : {},
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
        id: true,
        action: true,
        note: true,
        target_post_id: true,
        post_snapshot: true,
        created_at: true,
        actor: { select: { id: true, username: true } },
        target_user: { select: { id: true, username: true } },
      },
    });
    const nextCursor = rows.length === limit ? rows[rows.length - 1].created_at.toISOString() : null;
    return { actions: rows, nextCursor };
  }
}
