import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ReportStatus } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ModerationService } from '../moderation/moderation.service';
import { AdminService } from './admin.service';
import { BannedWordDto, NoteDto, SetRoleDto, SuspendDto, WarnDto } from './dto/admin.dto';

// Moderators and admins only. Role checks happen in RolesGuard; a few routes are admin-only.
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MODERATOR', 'ADMIN')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly moderation: ModerationService,
  ) {}

  private async actor(user: { sub: string }) {
    const status = await this.moderation.accountStatus(user.sub);
    if (!status.id) throw new BadRequestException('profile_not_found');
    return { id: status.id, role: status.role };
  }

  private parseLimit(limit?: string, fallback = 50) {
    const n = Number(limit ?? fallback);
    return Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : fallback;
  }

  @Get('me')
  async me(@CurrentUser() user: { sub: string }) {
    const actor = await this.actor(user);
    return { id: actor.id, role: actor.role };
  }

  @Get('summary')
  summary() {
    return this.admin.summary();
  }

  @Get('reports')
  reports(@Query('status') status?: string, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    const valid = status && (status === 'ALL' || Object.values(ReportStatus).includes(status as ReportStatus));
    return this.admin.listReports(valid ? (status as ReportStatus | 'ALL') : 'OPEN', cursor, this.parseLimit(limit));
  }

  @Post('reports/:id/dismiss')
  async dismiss(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: NoteDto) {
    return this.admin.dismissReports(await this.actor(user), id, dto.note);
  }

  @Post('posts/:id/hide')
  async hidePost(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: NoteDto) {
    return this.admin.hidePost(await this.actor(user), id, dto.note);
  }

  @Post('posts/:id/restore')
  async restorePost(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: NoteDto) {
    return this.admin.restorePost(await this.actor(user), id, dto.note);
  }

  @Delete('posts/:id')
  async deletePost(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: NoteDto) {
    return this.admin.deletePost(await this.actor(user), id, dto.note);
  }

  @Get('users')
  users(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.admin.searchUsers(q ?? '', this.parseLimit(limit, 30));
  }

  @Get('users/:id')
  user(@Param('id') id: string) {
    return this.admin.userDetail(id);
  }

  @Post('users/:id/warn')
  async warn(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: WarnDto) {
    return this.admin.warn(await this.actor(user), id, dto.note);
  }

  @Post('users/:id/suspend')
  async suspend(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: SuspendDto) {
    return this.admin.suspend(await this.actor(user), id, dto.days, dto.note);
  }

  @Post('users/:id/unsuspend')
  async unsuspend(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: NoteDto) {
    return this.admin.unsuspend(await this.actor(user), id, dto.note);
  }

  @Post('users/:id/ban')
  @Roles('ADMIN')
  async ban(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: NoteDto) {
    return this.admin.ban(await this.actor(user), id, dto.note);
  }

  @Post('users/:id/unban')
  @Roles('ADMIN')
  async unban(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: NoteDto) {
    return this.admin.unban(await this.actor(user), id, dto.note);
  }

  @Post('users/:id/verify')
  @Roles('ADMIN')
  async verify(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.admin.setVerified(await this.actor(user), id, true);
  }

  @Post('users/:id/unverify')
  @Roles('ADMIN')
  async unverify(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.admin.setVerified(await this.actor(user), id, false);
  }

  @Post('users/:id/role')
  @Roles('ADMIN')
  async setRole(@CurrentUser() user: { sub: string }, @Param('id') id: string, @Body() dto: SetRoleDto) {
    return this.admin.setRole(await this.actor(user), id, dto.role);
  }

  @Get('banned-words')
  bannedWords() {
    return this.admin.listBannedWords();
  }

  @Post('banned-words')
  async addBannedWord(@CurrentUser() user: { sub: string }, @Body() dto: BannedWordDto) {
    return this.admin.addBannedWord(await this.actor(user), dto.word);
  }

  @Delete('banned-words/:word')
  async removeBannedWord(@CurrentUser() user: { sub: string }, @Param('word') word: string) {
    return this.admin.removeBannedWord(await this.actor(user), word);
  }

  @Get('actions')
  actions(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.admin.listActions(cursor, this.parseLimit(limit));
  }
}
