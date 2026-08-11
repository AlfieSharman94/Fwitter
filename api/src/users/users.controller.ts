import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { deriveAgeTier } from './age-tier.util';
import { UpdateTeamsDto } from './dto/update-teams.dto';
import { UpdateTopicsDto } from './dto/update-topics.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
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
  } as const;

  @Get('me/profile')
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@CurrentUser() user: { sub: string }) {
    const profile = await this.prisma.users.findUnique({
      where: { cognito_sub: user.sub },
      select: this.meProfileSelect,
    });
    if (!profile) {
      throw new NotFoundException('profile_not_found');
    }
    return { user: profile };
  }

  @Patch('me/profile')
  @UseGuards(JwtAuthGuard)
  async updateMyProfile(
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateProfileDto,
  ) {
    const dbUser = await this.prisma.users.findUnique({
      where: { cognito_sub: user.sub },
      select: { id: true },
    });
    if (!dbUser) throw new BadRequestException('profile_not_found');

    const data: { username?: string; bio?: string | null } = {};

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

    try {
      const updated = await this.prisma.users.update({
        where: { id: dbUser.id },
        data,
        select: this.meProfileSelect,
      });
      return { user: updated };
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('username_taken');
      throw e;
    }
  }

  @Post('me/profile')
  @UseGuards(JwtAuthGuard)
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

  @Post('me/onboarding/complete')
  @UseGuards(JwtAuthGuard)
  async completeOnboarding(@CurrentUser() user: { sub: string }) {
    const dbUser = await this.prisma.users.findUnique({
      where: { cognito_sub: user.sub },
      select: { id: true },
    });
    if (!dbUser) throw new BadRequestException('profile_not_found');

    await this.prisma.users.update({
      where: { id: dbUser.id },
      data: { is_onboarded: true },
    });

    return { ok: true };
  }

  @Put('me/teams')
  @UseGuards(JwtAuthGuard)
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
    await this.prisma.user_teams.deleteMany({ where: { user_id: dbUser.id } });

    await this.prisma.user_teams.createMany({
      data: uniqueTeamIds.map((teamId) => ({
        user_id: dbUser.id,
        team_id: teamId,
        is_primary: teamId === dto.primaryTeamId,
      })),
    });

    return { ok: true };
  }

  @Put('me/topics')
  @UseGuards(JwtAuthGuard)
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

    await this.prisma.user_topics.deleteMany({ where: { user_id: dbUser.id } });

    await this.prisma.user_topics.createMany({
      data: uniqueTopicIds.map((topicId) => ({
        user_id: dbUser.id,
        topic_id: topicId,
      })),
    });

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

  @Get(':id/posts')
  @UseGuards(JwtAuthGuard)
  async getUserPosts(
    @Param('id') targetUserId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const n = Number(limit ?? 20);
    const take = Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 20;
    const createdBefore = cursor ? new Date(cursor) : undefined;

    const posts = await this.prisma.posts.findMany({
      where: {
        author_id: targetUserId,
        parent_post_id: null,
        ...(createdBefore ? { created_at: { lt: createdBefore } } : {}),
      },
      orderBy: { created_at: 'desc' },
      take,
      select: {
        id: true,
        content: true,
        created_at: true,
        author_id: true,
        users: { select: { username: true, display_name: true, profile_image_url: true } },
        post_teams: { select: { teams: { select: { id: true, name: true } } } },
        post_topics: { select: { topics: { select: { id: true, name: true } } } },
      },
    });

    const nextCursor = posts.length ? posts[posts.length - 1].created_at.toISOString() : null;
    return { posts, nextCursor };
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
