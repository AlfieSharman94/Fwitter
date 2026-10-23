import { ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

// The passport part of the guard is not under test: it is stubbed to accept the token.
const passportCanActivate = jest
  .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
  .mockResolvedValue(true);

afterAll(() => passportCanActivate.mockRestore());

function makeContext(sub: string | undefined) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user: sub ? { sub } : undefined }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

function makeGuard(allowPending: boolean | undefined) {
  const moderation = { assertActive: jest.fn().mockResolvedValue(undefined), assertConsented: jest.fn().mockResolvedValue(undefined) };
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(allowPending) } as any;
  return { guard: new JwtAuthGuard(moderation as any, reflector), moderation };
}

describe('JwtAuthGuard', () => {
  it('checks suspension and then consent on an ordinary route', async () => {
    const { guard, moderation } = makeGuard(undefined);
    await expect(guard.canActivate(makeContext('sub-1'))).resolves.toBe(true);
    expect(moderation.assertActive).toHaveBeenCalledWith('sub-1');
    expect(moderation.assertConsented).toHaveBeenCalledWith('sub-1');
  });

  it('skips the consent check on routes marked @AllowPendingConsent', async () => {
    const { guard, moderation } = makeGuard(true);
    await expect(guard.canActivate(makeContext('sub-1'))).resolves.toBe(true);
    expect(moderation.assertActive).toHaveBeenCalledWith('sub-1');
    expect(moderation.assertConsented).not.toHaveBeenCalled();
  });

  it('lets a suspension refusal through before looking at consent', async () => {
    const { guard, moderation } = makeGuard(undefined);
    moderation.assertActive.mockRejectedValue(new ForbiddenException({ message: 'account_suspended' }));
    await expect(guard.canActivate(makeContext('sub-1'))).rejects.toBeInstanceOf(ForbiddenException);
    expect(moderation.assertConsented).not.toHaveBeenCalled();
  });

  it('surfaces the consent refusal', async () => {
    const { guard, moderation } = makeGuard(undefined);
    moderation.assertConsented.mockRejectedValue(new ForbiddenException({ message: 'consent_pending' }));
    const err = await guard.canActivate(makeContext('sub-1')).catch((e) => e);
    expect(err.getResponse()).toEqual({ message: 'consent_pending' });
  });
});
