import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search users by username or display name
   */
  async searchUsers(
    viewerId: string,
    q: string,
    limit: number = 20,
  ): Promise<
    Array<{
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      isFollowing: boolean;
    }>
  > {
    const query = q.trim();
    if (!query || query.length < 2) {
      throw new BadRequestException('query_required_min_2_chars');
    }

    const limitNum = Math.min(Math.max(limit, 1), 50);

    // Search username and display_name (case-insensitive)
    const users = await this.prisma.users.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { display_name: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limitNum,
      select: {
        id: true,
        username: true,
        display_name: true,
        profile_image_url: true,
      },
      orderBy: { username: 'asc' },
    });

    // Get following status for each user
    const userIds = users.map((u) => u.id);
    const followingMap = new Map<string, boolean>();
    if (userIds.length > 0) {
      const follows = await this.prisma.follows.findMany({
        where: {
          follower_id: viewerId,
          following_id: { in: userIds },
        },
        select: { following_id: true },
      });
      follows.forEach((f) => followingMap.set(f.following_id, true));
    }

    return users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      avatarUrl: u.profile_image_url,
      isFollowing: followingMap.get(u.id) ?? false,
    }));
  }
}
