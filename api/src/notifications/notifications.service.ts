import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';
import { ModerationService } from '../moderation/moderation.service';

export type NotifyArgs = {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  postId?: string | null;
  // WARNING: what the moderator wrote. LINK: what happened, after the actor's name.
  note?: string | null;
};

const VERB: Record<NotificationType, string> = {
  REPLY: 'replied to your post',
  MENTION: 'mentioned you',
  QUOTE: 'quoted your post',
  LIKE: 'liked your post',
  REPOST: 'reposted your post',
  FOLLOW: 'followed you',
  WARNING: 'sent you a warning',
  LINK: 'updated a linked account',
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
    private readonly moderation: ModerationService,
  ) {}

  // Called from write paths without awaiting the push: a notification must never
  // fail or slow down the action that caused it. Self-actions and anything across
  // a block are ignored; the dedupe index makes repeats a no-op (no second push either).
  async notify(args: NotifyArgs) {
    if (args.recipientId === args.actorId) return;
    try {
      // Moderation warnings always get through; blocks only apply between members, and a
      // member is never told about an account they cannot see (a private JUNIOR acting on a
      // STANDARD account's post or profile).
      if (args.type !== 'WARNING') {
        if (await this.moderation.isBlockedEitherWay(args.recipientId, args.actorId)) return;
        // Linked accounts are a private arrangement between the two people, so a private
        // JUNIOR's link request still reaches the adult it was sent to.
        if (args.type !== 'LINK' && !(await this.moderation.isUserVisible(args.recipientId, args.actorId))) return;
      }
      const { count } = await this.prisma.notifications.createMany({
        data: [
          {
            user_id: args.recipientId,
            actor_id: args.actorId,
            type: args.type,
            post_id: args.postId ?? null,
            note: args.note ?? null,
          },
        ],
        skipDuplicates: true,
      });
      if (count === 0) return;

      if (args.type === 'WARNING') {
        // The moderator stays anonymous to the member.
        await this.push.sendToUser(args.recipientId, {
          title: 'Fwitter moderation',
          body: args.note ? `Warning: ${args.note}` : 'You have received a warning from the moderators.',
          data: { url: '/(tabs)/activity', type: args.type },
        });
        return;
      }

      const actor = await this.prisma.users.findUnique({
        where: { id: args.actorId },
        select: { display_name: true },
      });
      const url = args.type === 'LINK' ? '/linked-accounts' : args.postId ? `/posts/${args.postId}` : `/users/${args.actorId}`;
      await this.push.sendToUser(args.recipientId, {
        title: 'Fwitter',
        body: `${actor?.display_name ?? 'Someone'} ${args.type === 'LINK' && args.note ? args.note : VERB[args.type]}`,
        data: { url, type: args.type },
      });
    } catch (e: any) {
      this.logger.warn(`notify failed: ${e?.message ?? e}`);
    }
  }

  // Undo paths (unlike, unrepost, unfollow) remove the matching row.
  async remove(args: NotifyArgs) {
    try {
      await this.prisma.notifications.deleteMany({
        where: {
          user_id: args.recipientId,
          actor_id: args.actorId,
          type: args.type,
          post_id: args.postId ?? null,
        },
      });
    } catch (e: any) {
      this.logger.warn(`notification remove failed: ${e?.message ?? e}`);
    }
  }
}
