import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { LinkDecisionDto, LinkRequestDto, LinkSharesDto } from './dto/link.dto';
import { LinksService } from './links.service';

@Controller('links')
@UseGuards(JwtAuthGuard)
export class LinksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly links: LinksService,
  ) {}

  @Get()
  async list(@CurrentUser() user: { sub: string }) {
    return { links: await this.links.list(await this.me(user)) };
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async request(@CurrentUser() user: { sub: string }, @Body() dto: LinkRequestDto) {
    return this.links.request(await this.me(user), dto.viewerId, dto.shares);
  }

  @Post(':id/accept')
  @HttpCode(200)
  async accept(@CurrentUser() user: { sub: string }, @Param('id', ParseUUIDPipe) id: string) {
    await this.links.accept(await this.me(user), id);
    return { ok: true };
  }

  // Decline or cancel a request, or unlink.
  @Delete(':id')
  async remove(@CurrentUser() user: { sub: string }, @Param('id', ParseUUIDPipe) id: string) {
    await this.links.remove(await this.me(user), id);
    return { ok: true };
  }

  @Patch(':id/shares')
  async updateShares(@CurrentUser() user: { sub: string }, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LinkSharesDto) {
    await this.links.updateShares(await this.me(user), id, dto.shares);
    return { ok: true };
  }

  @Post(':id/change')
  @HttpCode(200)
  async reviewChange(@CurrentUser() user: { sub: string }, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LinkDecisionDto) {
    await this.links.reviewChange(await this.me(user), id, dto.yes);
    return { ok: true };
  }

  @Post(':id/stay')
  @HttpCode(200)
  async stay(@CurrentUser() user: { sub: string }, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LinkDecisionDto) {
    await this.links.answerStay(await this.me(user), id, dto.yes);
    return { ok: true };
  }

  @Get(':id/activity')
  async activity(@CurrentUser() user: { sub: string }, @Param('id', ParseUUIDPipe) id: string, @Query('cursor') cursor?: string) {
    const before = cursor ? new Date(cursor) : undefined;
    if (before && Number.isNaN(before.getTime())) throw new BadRequestException('invalid_cursor');
    return this.links.activity(await this.me(user), id, before);
  }

  private async me(user: { sub: string }): Promise<string> {
    const row = await this.prisma.users.findUnique({ where: { cognito_sub: user.sub }, select: { id: true } });
    if (!row) throw new BadRequestException('viewer_profile_not_found');
    return row.id;
  }
}
