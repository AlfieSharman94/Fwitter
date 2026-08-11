import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the database user ID from Cognito sub (JWT claim)
   */
  async getUserIdFromCognitoSub(cognitoSub: string): Promise<string> {
    const user = await this.prisma.users.findUnique({
      where: { cognito_sub: cognitoSub },
      select: { id: true },
    });
    if (!user) {
      throw new BadRequestException('viewer_profile_not_found');
    }
    return user.id;
  }

  /**
   * Follow a user (idempotent)
   */
  async followUser(viewerId: string, targetId: string): Promise<{
    isFollowing: boolean;
    followersCount: number;
    followingCount: number;
  }> {
    // Prevent self-follow
    if (viewerId === targetId) {
      throw new BadRequestException('cannot_follow_self');
    }

    // Verify target user exists
    const targetUser = await this.prisma.users.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!targetUser) {
      throw new NotFoundException('user_not_found');
    }

    // Idempotent: create if not exists, ignore if already exists
    try {
      await this.prisma.follows.create({
        data: {
          follower_id: viewerId,
          following_id: targetId,
        },
      });
    } catch (e: any) {
      // P2002 = unique constraint violation (already following)
      if (e?.code !== 'P2002') {
        throw e;
      }
      // Already following - idempotent success
    }

    // Get updated counts
    const [followersCount, followingCount] = await Promise.all([
      this.prisma.follows.count({ where: { following_id: targetId } }),
      this.prisma.follows.count({ where: { follower_id: targetId } }),
    ]);

    return {
      isFollowing: true,
      followersCount,
      followingCount,
    };
  }

  /**
   * Unfollow a user (idempotent)
   */
  async unfollowUser(viewerId: string, targetId: string): Promise<{
    isFollowing: boolean;
    followersCount: number;
    followingCount: number;
  }> {
    // Idempotent: delete if exists, ignore if not
    await this.prisma.follows.deleteMany({
      where: {
        follower_id: viewerId,
        following_id: targetId,
      },
    });

    // Get updated counts
    const [followersCount, followingCount] = await Promise.all([
      this.prisma.follows.count({ where: { following_id: targetId } }),
      this.prisma.follows.count({ where: { follower_id: targetId } }),
    ]);

    return {
      isFollowing: false,
      followersCount,
      followingCount,
    };
  }

  /**
   * Get public profile with counts and relationship
   */
  async getPublicProfile(viewerId: string, targetId: string): Promise<{
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    createdAt: Date;
    followersCount: number;
    followingCount: number;
    postsCount: number;
    isFollowing: boolean;
    isSelf: boolean;
  }> {
    const targetUser = await this.prisma.users.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        username: true,
        display_name: true,
        profile_image_url: true,
        created_at: true,
      },
    });
    if (!targetUser) {
      throw new NotFoundException('user_not_found');
    }

    // Get counts in parallel
    const [followersCount, followingCount, postsCount, isFollowing] = await Promise.all([
      this.prisma.follows.count({ where: { following_id: targetId } }),
      this.prisma.follows.count({ where: { follower_id: targetId } }),
      this.prisma.posts.count({ where: { author_id: targetId, parent_post_id: null } }),
      this.prisma.follows
        .findUnique({
          where: {
            follower_id_following_id: {
              follower_id: viewerId,
              following_id: targetId,
            },
          },
        })
        .then((f) => !!f),
    ]);

    const isSelf = viewerId === targetId;

    return {
      id: targetUser.id,
      username: targetUser.username,
      displayName: targetUser.display_name,
      avatarUrl: targetUser.profile_image_url,
      createdAt: targetUser.created_at,
      followersCount,
      followingCount,
      postsCount,
      isFollowing,
      isSelf,
    };
  }

  /**
   * Get followers list for a user
   */
  async getFollowers(viewerId: string, targetId: string, limit: number = 20): Promise<
    Array<{
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      isFollowing: boolean;
    }>
  > {
    const limitNum = Math.min(Math.max(limit, 1), 50);

    const follows = await this.prisma.follows.findMany({
      where: { following_id: targetId },
      take: limitNum,
      select: {
        follower_id: true,
        users_follows_follower_idTousers: {
          select: {
            id: true,
            username: true,
            display_name: true,
            profile_image_url: true,
          },
        },
      },
    });

    const followerIds = follows.map((f) => f.follower_id);
    const followingMap = new Map<string, boolean>();
    if (followerIds.length > 0) {
      const viewerFollows = await this.prisma.follows.findMany({
        where: {
          follower_id: viewerId,
          following_id: { in: followerIds },
        },
        select: { following_id: true },
      });
      viewerFollows.forEach((f) => followingMap.set(f.following_id, true));
    }

    return follows.map((f) => ({
      id: f.users_follows_follower_idTousers.id,
      username: f.users_follows_follower_idTousers.username,
      displayName: f.users_follows_follower_idTousers.display_name,
      avatarUrl: f.users_follows_follower_idTousers.profile_image_url,
      isFollowing: followingMap.get(f.users_follows_follower_idTousers.id) ?? false,
    }));
  }

  /**
   * Get following list for a user
   */
  async getFollowing(viewerId: string, targetId: string, limit: number = 20): Promise<
    Array<{
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      isFollowing: boolean;
    }>
  > {
    const limitNum = Math.min(Math.max(limit, 1), 50);

    const follows = await this.prisma.follows.findMany({
      where: { follower_id: targetId },
      take: limitNum,
      select: {
        following_id: true,
        users_follows_following_idTousers: {
          select: {
            id: true,
            username: true,
            display_name: true,
            profile_image_url: true,
          },
        },
      },
    });

    const followingIds = follows.map((f) => f.following_id);
    const followingMap = new Map<string, boolean>();
    if (followingIds.length > 0) {
      const viewerFollows = await this.prisma.follows.findMany({
        where: {
          follower_id: viewerId,
          following_id: { in: followingIds },
        },
        select: { following_id: true },
      });
      viewerFollows.forEach((f) => followingMap.set(f.following_id, true));
    }

    return follows.map((f) => ({
      id: f.users_follows_following_idTousers.id,
      username: f.users_follows_following_idTousers.username,
      displayName: f.users_follows_following_idTousers.display_name,
      avatarUrl: f.users_follows_following_idTousers.profile_image_url,
      isFollowing: followingMap.get(f.users_follows_following_idTousers.id) ?? false,
    }));
  }
}
