import { ForbiddenException } from '@nestjs/common';
import { ModerationService } from './moderation.service';

const junior = {
  id: 'u1',
  role: 'USER',
  suspended_until: null,
  banned_at: null,
  age_tier: 'JUNIOR',
  is_onboarded: true,
  guardian_consent: null as { confirmed_at: Date | null } | null,
};

function makeService(dbUser: Record<string, unknown> | null) {
  const findUnique = jest.fn().mockResolvedValue(dbUser);
  const service = new ModerationService({ users: { findUnique } } as any);
  return { service, findUnique };
}

describe('ModerationService.assertConsented', () => {
  it('refuses an onboarded JUNIOR until a guardian confirms', async () => {
    const { service } = makeService(junior);
    const err = await service.assertConsented('sub-1').catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse()).toEqual({ message: 'consent_pending' });
  });

  it('passes once consent is confirmed', async () => {
    const { service } = makeService({ ...junior, guardian_consent: { confirmed_at: new Date() } });
    await expect(service.assertConsented('sub-1')).resolves.toBeUndefined();
  });

  it('passes STANDARD accounts, accounts still onboarding, and missing rows', async () => {
    await expect(makeService({ ...junior, age_tier: 'STANDARD' }).service.assertConsented('sub-1')).resolves.toBeUndefined();
    await expect(makeService({ ...junior, is_onboarded: false }).service.assertConsented('sub-1')).resolves.toBeUndefined();
    await expect(makeService(null).service.assertConsented('sub-1')).resolves.toBeUndefined();
  });
});

describe('ModerationService status cache', () => {
  it('invalidateStatusBySub forces the next lookup', async () => {
    const { service, findUnique } = makeService(junior);
    await service.accountStatus('sub-1');
    await service.accountStatus('sub-1');
    expect(findUnique).toHaveBeenCalledTimes(1);
    service.invalidateStatusBySub('sub-1');
    await service.accountStatus('sub-1');
    expect(findUnique).toHaveBeenCalledTimes(2);
  });
});
