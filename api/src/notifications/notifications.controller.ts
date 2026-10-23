import { BadRequestException, Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PushTokenDto, RemovePushTokenDto } from './dto/push-token.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  private async requireViewer(sub: string) {
    const dbUser = await this.prisma.users.findUnique({
      where: { cognito_sub: sub },
      select: { id: true },
    });
    if (!dbUser) throw new BadRequestException('profile_not_found');
    return dbUser;
  }

  @Get()
  async list(
    @CurrentUser() user: { sub: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const viewer = await this.requireViewer(user.sub);
    const n = Number(limit ?? 30);
    const take = Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 30;
    const createdBefore = cursor ? new Date(cursor) : undefined;

    const rows = await this.prisma.notifications.findMany({
      where: {
        user_id: viewer.id,
        ...(createdBefore ? { created_at: { lt: createdBefore } } : {}),
      },
      orderBy: { created_at: 'desc' },
      take,
      select: {
        id: true,
        type: true,
        note: true,
        created_at: true,
        read_at: true,
        actor: { select: { id: true, username: true, display_name: true, profile_image_url: true } },
        posts: { select: { id: true, content: true, parent_post_id: true } },
      },
    });

    const nextCursor = rows.length ? rows[rows.length - 1].created_at.toISOString() : null;
    return {
      notifications: rows.map(({ posts, ...rest }) => ({ ...rest, post: posts })),
      nextCursor,
    };
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: { sub: string }) {
    const viewer = await this.requireViewer(user.sub);
    const count = await this.prisma.notifications.count({ where: { user_id: viewer.id, read_at: null } });
    return { count };
  }

  // Marks everything unread as read. Called when the Activity tab is opened.
  @Post('read')
  async markAllRead(@CurrentUser() user: { sub: string }) {
    const viewer = await this.requireViewer(user.sub);
    await this.prisma.notifications.updateMany({
      where: { user_id: viewer.id, read_at: null },
      data: { read_at: new Date() },
    });
    return { ok: true };
  }

  // A token moves with the device: re-registering under another account re-points it.
  @Post('push-token')
  async registerPushToken(@CurrentUser() user: { sub: string }, @Body() dto: PushTokenDto) {
    const viewer = await this.requireViewer(user.sub);
    await this.prisma.push_tokens.upsert({
      where: { token: dto.token },
      create: { token: dto.token, user_id: viewer.id, platform: dto.platform ?? null },
      update: { user_id: viewer.id, platform: dto.platform ?? null, updated_at: new Date() },
    });
    return { ok: true };
  }

  @Delete('push-token')
  async removePushToken(@CurrentUser() user: { sub: string }, @Body() dto: RemovePushTokenDto) {
    const viewer = await this.requireViewer(user.sub);
    await this.prisma.push_tokens.deleteMany({ where: { token: dto.token, user_id: viewer.id } });
    return { ok: true };
  }
}
