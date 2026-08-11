import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AgeTier } from '@prisma/client';
import { MinAgeTierGuard } from './min-age-tier.guard';

function makeContext(sub?: string) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user: sub ? { sub } : undefined }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

function makeGuard(requiredTier: AgeTier | undefined, userTier: AgeTier | null) {
  const reflector = { getAllAndOverride: () => requiredTier } as unknown as Reflector;
  const prisma = {
    users: {
      findUnique: async () => (userTier ? { age_tier: userTier } : null),
    },
  } as any;
  return new MinAgeTierGuard(reflector, prisma);
}

describe('MinAgeTierGuard', () => {
  it('allows when the route has no tier requirement', async () => {
    const guard = makeGuard(undefined, AgeTier.JUNIOR);
    await expect(guard.canActivate(makeContext('sub'))).resolves.toBe(true);
  });

  it('allows a STANDARD user on a JUNIOR-required route', async () => {
    const guard = makeGuard(AgeTier.JUNIOR, AgeTier.STANDARD);
    await expect(guard.canActivate(makeContext('sub'))).resolves.toBe(true);
  });

  it('allows a JUNIOR user on a JUNIOR-required route', async () => {
    const guard = makeGuard(AgeTier.JUNIOR, AgeTier.JUNIOR);
    await expect(guard.canActivate(makeContext('sub'))).resolves.toBe(true);
  });

  it('allows a STANDARD user on a STANDARD-required route', async () => {
    const guard = makeGuard(AgeTier.STANDARD, AgeTier.STANDARD);
    await expect(guard.canActivate(makeContext('sub'))).resolves.toBe(true);
  });

  it('denies a JUNIOR user on a STANDARD-required route (403)', async () => {
    const guard = makeGuard(AgeTier.STANDARD, AgeTier.JUNIOR);
    await expect(guard.canActivate(makeContext('sub'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('401s when no authenticated user is present', async () => {
    const guard = makeGuard(AgeTier.JUNIOR, AgeTier.JUNIOR);
    await expect(guard.canActivate(makeContext(undefined))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('403s when the user has no profile row', async () => {
    const guard = makeGuard(AgeTier.JUNIOR, null);
    await expect(guard.canActivate(makeContext('sub'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
