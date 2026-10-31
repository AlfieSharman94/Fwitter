import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AgeTier } from '@prisma/client';
import { feedPostSelect, toFeedPost } from '../posts/post-shape';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CompleteOnboardingDto, GuardianEmailDto } from './dto/guardian.dto';
import { deriveAgeTier } from './age-tier.util';
import { UpdateTeamsDto } from './dto/update-teams.dto';
import { UpdateTopicsDto } from './dto/update-topics.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AllowPendingConsent } from '../auth/allow-pending-consent.decorator';
import { UsersService } from './users.service';
import { ModerationService } from '../moderation/moderation.service';
import { MediaService } from '../media/media.service';
import { ConsentService } from '../consent/consent.service';
import { ConsentApproveDto } from '../links/dto/link.dto';
import { isConsentPending } from '../consent/consent-status';

@Controller('users')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly moderation: ModerationService,
    private readonly media: MediaService,
    private readonly consent: ConsentService,
  ) {}

  // The app's post-sign-in session check, so it must work for an account awaiting consent.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @AllowPendingConsent()
  me(@CurrentUser() user: { sub: string; email?: string }) {
    return { ok: true, user };
  }

  private readonly meProfileSelect = {
    id: true,
    username: true,
    display_name: true,
    email: true,
    is_onboarded: true,
    date_of_birth: true,
    created_at: true,
    bio: true,
    profile_image_url: true,
    verified_at: true,
    age_tier: true,
    public_profile: true,
    guardian_consent: { select: { guardian_email: true, sent_at: true, confirmed_at: true } },
  } as const;

  // consent_pending is the server's word on whether the app should show the waiting screen.
  private withConsentFlag<
    T extends { id: string; age_tier: AgeTier; is_onboarded: boolean; guardian_consent: { confirmed_at: Date | null } | null },
  >(profile: T) {
    return {
      ...profile,
      consent_pending: isConsentPending({
        id: profile.id,
        age_tier: profile.age_tier,
        is_onboarded: profile.is_onboarded,
        consent_confirmed_at: profile.guardian_consent?.confirmed_at ?? null,
      }),
    };
  }

  @Get('me/profile')
  @UseGuards(JwtAuthGuard)
  @AllowPendingConsent()
  async getMyProfile(@CurrentUser() user: { sub: string }) {
    const profile = await this.prisma.users.findUnique({
      where: { cognito_sub: user.sub },
      select: this.meProfileSelect,
    });
    if (!profile) {
      throw new NotFoundException('profile_not_found');
    }
    return { user: this.withConsentFlag(profile) };
  }

  @Patch('me/profile')
  @UseGuards(JwtAuthGuard)
  async updateMyProfile(
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateProfileDto,
  ) {
    await this.moderation.assertContentAllowed(dto.username, dto.bio);
    const dbUser = await this.prisma.users.findUnique({
      where: { cognito_sub: user.sub },
      select: { id: true },
    });
    if (!dbUser) throw new BadRequestException('profile_not_found');

    const data: { username?: string; bio?: string | null; profile_image_url?: string; public_profile?: boolean } = {};

    if (dto.username !== undefined) {
      // Case-insensitive uniqueness, excluding the user's own row.
      const existing = await this.prisma.users.findFirst({
        where: { username: { equals: dto.username, mode: 'insensitive' }, id: { not: dbUser.id } },
        select: { id: true },
      });
      if (existing) throw new ConflictException('username_taken');
      data.username = dto.username;
    }

    if (dto.bio !== undefined) {
      const trimmed = dto.bio.trim();
      data.bio = trimmed === '' ? null : trimmed;
    }

    if (dto.avatarMediaId) {
      data.profile_image_url = await this.media.avatarUrl(dbUser.id, dto.avatarMediaId);
    }

    if (dto.publicProfile !== undefined) data.public_profile = dto.publicProfile;

    try {
      const updated = await this.prisma.users.update({
        where: { id: dbUser.id },
        data,
        select: this.meProfileSelect,
      });
      return { user: this.withConsentFlag(updated) };
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('username_taken');
      throw e;
    }
  }

  @Post('me/profile')
  @UseGuards(JwtAuthGuard)
  @AllowPendingConsent()
  async createMyProfile(
    @CurrentUser() user: { sub: string; email?: string },
    @Body() dto: CreateProfileDto,
  ) {
    if (!user?.sub) throw new ConflictException('missing_sub');
    if (!user?.email) throw new ConflictException('missing_email');

    // If profile already exists, return it (idempotent)
    const existing = await this.prisma.users.findUnique({
      where: { cognito_sub: user.sub },
      select: { id: true, username: true, display_name: true, email: true, is_onboarded: true },
    });

    if (existing) return { user: existing };
    await this.moderation.assertContentAllowed(dto.username, dto.displayName);

    try {
      // Age tier is derived server-side from DOB — the client-sent value is ignored.
      const dob = new Date(dto.dateOfBirth);
      const created = await this.prisma.users.create({
        data: {
          cognito_sub: user.sub,
          email: user.email,
          username: dto.username,
          display_name: dto.displayName,
          date_of_birth: dob,
          age_tier: deriveAgeTier(dob),
          is_onboarded: false,
        },
        select: { id: true, username: true, display_name: true, email: true, is_onboarded: true },
      });
      // The guard cached "no row" for this sub moments ago; the next request must see the row.
      this.moderation.invalidateStatusBySub(user.sub);

      return { user: created };
    } catch (e: any) {
      // Prisma unique violations
      if (e?.code === 'P2002') {
        const target = Array.isArray(e?.meta?.target) ? e.meta.target.join(',') : String(e?.meta?.target ?? '');
        const t = target.toLowerCase();
        if (t.includes('username')) throw new ConflictException('username_taken');
        if (t.includes('email')) throw new ConflictException('email_taken');
        if (t.includes('cognito_sub')) throw new ConflictException('profile_already_exists');
        throw new ConflictException('unique_constraint');
      }
      throw e;
    }
  }

  // A JUNIOR account is locked from here until a guardian confirms (see JwtAuthGuard). The
  // guardian email is optional in the body: a JUNIOR who gave none is asked for it by the app.
  @Post('me/onboarding/complete')
  @UseGuards(JwtAuthGuard)
  @AllowPendingConsent()
  async completeOnboarding(@CurrentUser() user: { sub: string }, @Body() dto: CompleteOnboardingDto) {
    const dbUser = await this.prisma.users.findUnique({
      where: { cognito_sub: user.sub },
      select: { id: true },
    });
    if (!dbUser) throw new BadRequestException('profile_not_found');

    await this.prisma.users.update({
      where: { id: dbUser.id },
      data: { is_onboarded: true },
    });
    this.moderation.invalidateStatusBySub(user.sub);
    const consent = await this.consent.ensureRequested(dbUser.id, dto.guardianEmail);

    return { ok: true, consent };
  }

  @Patch('me/guardian')
  @UseGuards(JwtAuthGuard)
  @AllowPendingConsent()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async setGuardian(@CurrentUser() user: { sub: string }, @Body() dto: GuardianEmailDto) {
    const viewerId = await this.usersService.getUserIdFromCognitoSub(user.sub);
    const consent = await this.consent.setGuardian(viewerId, dto.guardianEmail);
    return { ok: true, consent };
  }

  @Post('me/guardian/resend')
  @UseGuards(JwtAuthGuard)
  @AllowPendingConsent()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async resendGuardianEmail(@CurrentUser() user: { sub: string }) {
    const viewerId = await this.usersService.getUserIdFromCognitoSub(user.sub);
    const consent = await this.consent.resend(viewerId);
    return { ok: true, consent };
  }

  // The parent or guardian side: children who gave this account's email and are waiting.
  @Get('me/consent-requests')
  @UseGuards(JwtAuthGuard)
  async consentRequests(@CurrentUser() user: { sub: string }) {
    const viewerId = await this.usersService.getUserIdFromCognitoSub(user.sub);
    return { requests: await this.consent.pendingFor(viewerId) };
  }

  @Post('me/consent-requests/:userId/approve')
  @UseGuards(JwtAuthGuard)
  async approveConsent(
    @CurrentUser() user: { sub: string },
    @Param('userId', ParseUUIDPipe) childId: string,
    @Body() dto: ConsentApproveDto,
  ) {
    const viewerId = await this.usersService.getUserIdFromCognitoSub(user.sub);
    await this.consent.confirmFor(viewerId, childId, !!dto.link);
    return { ok: true };
  }

  @Post('me/consent-requests/:userId/decline')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async declineConsent(@CurrentUser() user: { sub: string }, @Param('userId', ParseUUIDPipe) childId: string) {
    const viewerId = await this.usersService.getUserIdFromCognitoSub(user.sub);
    await this.consent.declineFor(viewerId, childId);
    return { ok: true };
  }

  @Put('me/teams')
  @UseGuards(JwtAuthGuard)
  @AllowPendingConsent()
  async setTeams(
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateTeamsDto,
  ) {
    const dbUser = await this.prisma.users.findUnique({
      where: { cognito_sub: user.sub },
      select: { id: true },
    });
    if (!dbUser) throw new BadRequestException('profile_not_found');

    const uniqueTeamIds = Array.from(new Set(dto.teamIds));
    if (!uniqueTeamIds.includes(dto.primaryTeamId)) {
      throw new BadRequestException('primary_must_be_in_teamIds');
    }

    // validate teams exist
    const found = await this.prisma.teams.findMany({
      where: { id: { in: uniqueTeamIds } },
      select: { id: true },
    });
    if (found.length !== uniqueTeamIds.length) {
      throw new BadRequestException('one_or_more_teams_not_found');
    }

    // Replace selection (simple & safe)
    await this.prisma.$transaction([
      this.prisma.user_teams.deleteMany({ where: { user_id: dbUser.id } }),
      this.prisma.user_teams.createMany({
        data: uniqueTeamIds.map((teamId) => ({
          user_id: dbUser.id,
          team_id: teamId,
          is_primary: teamId === dto.primaryTeamId,
        })),
      }),
    ]);

    return { ok: true };
  }

  @Put('me/topics')
  @UseGuards(JwtAuthGuard)
  @AllowPendingConsent()
  async setTopics(
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateTopicsDto,
  ) {
    const dbUser = await this.prisma.users.findUnique({
      where: { cognito_sub: user.sub },
      select: { id: true },
    });
    if (!dbUser) throw new BadRequestException('profile_not_found');

    const uniqueTopicIds = Array.from(new Set(dto.topicIds));

    const found = await this.prisma.topics.findMany({
      where: { id: { in: uniqueTopicIds } },
      select: { id: true },
    });
    if (found.length !== uniqueTopicIds.length) {
      throw new BadRequestException('one_or_more_topics_not_found');
    }

    await this.prisma.$transaction([
      this.prisma.user_topics.deleteMany({ where: { user_id: dbUser.id } }),
      this.prisma.user_topics.createMany({
        data: uniqueTopicIds.map((topicId) => ({
          user_id: dbUser.id,
          topic_id: topicId,
        })),
      }),
    ]);

    return { ok: true };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getPublicProfile(
    @CurrentUser() viewer: { sub: string },
    @Param('id') targetUserId: string,
  ) {
    const viewerId = await this.usersService.getUserIdFromCognitoSub(viewer.sub);
    const profile = await this.usersService.getPublicProfile(viewerId, targetUserId);
    return profile;
  }

  @Get('me/bookmarks')
  @UseGuards(JwtAuthGuard)
  async myBookmarks(
    @CurrentUser() user: { sub: string },
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const dbUser = await this.prisma.users.findUnique({
      where: { cognito_sub: user.sub },
      select: { id: true },
    });
    if (!dbUser) throw new BadRequestException('profile_not_found');

    const n = Number(limit ?? 20);
    const take = Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 20;
    // Cursor is the bookmark's own created_at (newest saved first), not the post's.
    const savedBefore = cursor ? new Date(cursor) : undefined;

    const rows = await this.prisma.bookmarks.findMany({
      where: {
        user_id: dbUser.id,
        ...(savedBefore ? { created_at: { lt: savedBefore } } : {}),
        posts: await this.moderation.visibility(dbUser.id),
      },
      orderBy: { created_at: 'desc' },
      take,
      select: { created_at: true, posts: { select: feedPostSelect(dbUser.id) } },
    });

    const nextCursor = rows.length ? rows[rows.length - 1].created_at.toISOString() : null;
    return { posts: rows.map((r) => toFeedPost(r.posts, dbUser.id)), nextCursor };
  }

  @Get(':id/posts')
  @UseGuards(JwtAuthGuard)
  async getUserPosts(
    @CurrentUser() user: { sub: string },
    @Param('id') targetUserId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const viewer = await this.prisma.users.findUnique({
      where: { cognito_sub: user.sub },
      select: { id: true },
    });
    if (!viewer) throw new BadRequestException('profile_not_found');

    const n = Number(limit ?? 20);
    const take = Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 20;
    const createdBefore = cursor ? new Date(cursor) : undefined;

    const posts = await this.prisma.posts.findMany({
      where: {
        author_id: targetUserId,
        parent_post_id: null,
        ...(createdBefore ? { created_at: { lt: createdBefore } } : {}),
        ...(await this.moderation.visibility(viewer.id)),
      },
      orderBy: { created_at: 'desc' },
      take,
      select: feedPostSelect(viewer.id),
    });

    const nextCursor = posts.length ? posts[posts.length - 1].created_at.toISOString() : null;
    return { posts: posts.map((p) => toFeedPost(p, viewer.id)), nextCursor };
  }

  @Post(':id/follow')
  @UseGuards(JwtAuthGuard)
  async followUser(
    @CurrentUser() viewer: { sub: string },
    @Param('id') targetUserId: string,
  ) {
    const viewerId = await this.usersService.getUserIdFromCognitoSub(viewer.sub);
    const result = await this.usersService.followUser(viewerId, targetUserId);
    return result;
  }

  @Delete(':id/follow')
  @UseGuards(JwtAuthGuard)
  async unfollowUser(
    @CurrentUser() viewer: { sub: string },
    @Param('id') targetUserId: string,
  ) {
    const viewerId = await this.usersService.getUserIdFromCognitoSub(viewer.sub);
    const result = await this.usersService.unfollowUser(viewerId, targetUserId);
    return result;
  }

  @Post(':id/block')
  @UseGuards(JwtAuthGuard)
  async blockUser(@CurrentUser() viewer: { sub: string }, @Param('id') targetUserId: string) {
    const viewerId = await this.usersService.getUserIdFromCognitoSub(viewer.sub);
    return this.moderation.block(viewerId, targetUserId);
  }

  @Delete(':id/block')
  @UseGuards(JwtAuthGuard)
  async unblockUser(@CurrentUser() viewer: { sub: string }, @Param('id') targetUserId: string) {
    const viewerId = await this.usersService.getUserIdFromCognitoSub(viewer.sub);
    return this.moderation.unblock(viewerId, targetUserId);
  }

  // Immediate, irreversible. Everything the user owns cascades with the row: posts and
  // their replies, likes, reposts, bookmarks, follows, votes, notifications, push tokens,
  // reports and blocks. The client deletes the Cognito user afterwards.
  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @AllowPendingConsent()
  async deleteMyAccount(@CurrentUser() user: { sub: string }) {
    const dbUser = await this.prisma.users.findUnique({
      where: { cognito_sub: user.sub },
      select: { id: true },
    });
    if (!dbUser) throw new NotFoundException('profile_not_found');
    await this.prisma.users.delete({ where: { id: dbUser.id } });
    return { ok: true };
  }

  @Get(':id/followers')
  @UseGuards(JwtAuthGuard)
  async getFollowers(
    @CurrentUser() viewer: { sub: string },
    @Param('id') targetUserId: string,
    @Query('limit') limit?: string,
  ) {
    const viewerId = await this.usersService.getUserIdFromCognitoSub(viewer.sub);
    const limitNum = limit ? Number(limit) : 20;
    const users = await this.usersService.getFollowers(viewerId, targetUserId, limitNum);
    return { users };
  }

  @Get(':id/following')
  @UseGuards(JwtAuthGuard)
  async getFollowing(
    @CurrentUser() viewer: { sub: string },
    @Param('id') targetUserId: string,
    @Query('limit') limit?: string,
  ) {
    const viewerId = await this.usersService.getUserIdFromCognitoSub(viewer.sub);
    const limitNum = limit ? Number(limit) : 20;
    const users = await this.usersService.getFollowing(viewerId, targetUserId, limitNum);
    return { users };
  }
}
