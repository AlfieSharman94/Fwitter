import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DmService } from './dm.service';
import { OpenConversationDto, SendMessageDto } from './dto/dm.dto';

@Controller('dm')
@UseGuards(JwtAuthGuard)
export class DmController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dm: DmService,
  ) {}

  private async requireViewer(sub: string) {
    const dbUser = await this.prisma.users.findUnique({ where: { cognito_sub: sub }, select: { id: true } });
    if (!dbUser) throw new BadRequestException('profile_not_found');
    return dbUser;
  }

  @Get('conversations')
  async list(@CurrentUser() user: { sub: string }) {
    const viewer = await this.requireViewer(user.sub);
    return this.dm.list(viewer.id);
  }

  @Get('unread-count')
  async unread(@CurrentUser() user: { sub: string }) {
    const viewer = await this.requireViewer(user.sub);
    return this.dm.unreadTotal(viewer.id);
  }

  @Post('conversations')
  async open(@CurrentUser() user: { sub: string }, @Body() dto: OpenConversationDto) {
    const viewer = await this.requireViewer(user.sub);
    return this.dm.open(viewer.id, dto.userId);
  }

  @Get('conversations/:id/messages')
  async messages(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const viewer = await this.requireViewer(user.sub);
    const n = Number(limit ?? 30);
    const take = Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : 30;
    return this.dm.messages(viewer.id, id, cursor, take);
  }

  @Post('conversations/:id/messages')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async send(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: SendMessageDto) {
    const viewer = await this.requireViewer(user.sub);
    return this.dm.send(viewer.id, id, dto.content);
  }
}
