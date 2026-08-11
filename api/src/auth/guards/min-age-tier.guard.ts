import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AgeTier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const MIN_AGE_TIER_KEY = 'minAgeTier';

/**
 * Restrict a route to users at or above a given age tier.
 * Must be used alongside JwtAuthGuard (it reads the authenticated user's sub).
 *
 * Usage: @UseGuards(JwtAuthGuard, MinAgeTierGuard) @MinAgeTier(AgeTier.STANDARD)
 */
export const MinAgeTier = (tier: AgeTier) => SetMetadata(MIN_AGE_TIER_KEY, tier);

// Higher number = higher tier. STANDARD (16+) outranks JUNIOR (13–15).
const TIER_RANK: Record<AgeTier, number> = {
  JUNIOR: 1,
  STANDARD: 2,
};

@Injectable()
export class MinAgeTierGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredTier = this.reflector.getAllAndOverride<AgeTier | undefined>(
      MIN_AGE_TIER_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No tier requirement on this route — allow through.
    if (!requiredTier) return true;

    const request = context.switchToHttp().getRequest();
    const sub: string | undefined = request.user?.sub;
    if (!sub) {
      // Guard was reached without an authenticated user (JwtAuthGuard missing/failed).
      throw new UnauthorizedException();
    }

    const dbUser = await this.prisma.users.findUnique({
      where: { cognito_sub: sub },
      select: { age_tier: true },
    });
    if (!dbUser) {
      throw new ForbiddenException('profile_not_found');
    }

    if (TIER_RANK[dbUser.age_tier] < TIER_RANK[requiredTier]) {
      throw new ForbiddenException('insufficient_age_tier');
    }
    return true;
  }
}
