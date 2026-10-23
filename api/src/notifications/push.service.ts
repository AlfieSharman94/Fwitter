import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { PrismaService } from '../prisma/prisma.service';

export type PushPayload = { title: string; body: string; data: Record<string, unknown> };

// Sends through Expo's push service to every device token a user has registered.
// Delivery to APNs/FCM needs push credentials configured in EAS for the app.
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly expo = new Expo();

  constructor(private readonly prisma: PrismaService) {}

  async sendToUser(userId: string, payload: PushPayload) {
    const rows = await this.prisma.push_tokens.findMany({
      where: { user_id: userId },
      select: { token: true },
    });
    const tokens = rows.map((r) => r.token).filter((t) => Expo.isExpoPushToken(t));
    if (!tokens.length) return;

    const messages: ExpoPushMessage[] = tokens.map((to) => ({
      to,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data,
    }));

    for (const chunk of this.expo.chunkPushNotifications(messages)) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          if (ticket.status === 'error') {
            this.logger.warn(`push error: ${ticket.message} (${ticket.details?.error ?? 'unknown'})`);
            // The device uninstalled the app or revoked permission: drop the token.
            if (ticket.details?.error === 'DeviceNotRegistered') {
              const to = chunk[i].to;
              const dead = Array.isArray(to) ? to : [to];
              await this.prisma.push_tokens.deleteMany({ where: { token: { in: dead } } });
            }
          }
        }
      } catch (e: any) {
        this.logger.warn(`push send failed: ${e?.message ?? e}`);
      }
    }
  }
}
