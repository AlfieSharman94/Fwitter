import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function contextFor(sub: string | null, required: string[] | undefined) {
  const reflector = {
    getAllAndOverride: () => required,
  } as unknown as Reflector;
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user: sub ? { sub } : undefined }) }),
  } as unknown as ExecutionContext;
  return { reflector, context };
}

// `null` sub = no authenticated user (undefined would just trigger the default).
function guardWithRole(role: string, required: string[] | undefined, sub: string | null = 'sub-1') {
  const { reflector, context } = contextFor(sub, required);
  const moderation = { accountStatus: async () => ({ role }) } as any;
  return { guard: new RolesGuard(reflector, moderation), context };
}

describe('RolesGuard', () => {
  it('passes routes without @Roles', async () => {
    const { guard, context } = guardWithRole('USER', undefined);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('allows a listed role and refuses others', async () => {
    const mod = guardWithRole('MODERATOR', ['MODERATOR', 'ADMIN']);
    await expect(mod.guard.canActivate(mod.context)).resolves.toBe(true);

    const user = guardWithRole('USER', ['MODERATOR', 'ADMIN']);
    await expect(user.guard.canActivate(user.context)).rejects.toBeInstanceOf(ForbiddenException);

    const modOnAdmin = guardWithRole('MODERATOR', ['ADMIN']);
    await expect(modOnAdmin.guard.canActivate(modOnAdmin.context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses when there is no authenticated user', async () => {
    const { guard, context } = guardWithRole('ADMIN', ['ADMIN'], null);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
