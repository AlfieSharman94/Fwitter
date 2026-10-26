import { NotificationsService } from './notifications.service';

// expo-server-sdk is ESM-only; the push service is replaced by the stub below anyway.
jest.mock('./push.service', () => ({ PushService: class {} }));

function setup(opts: { blocked?: boolean; visible?: boolean }) {
  const createMany = jest.fn().mockResolvedValue({ count: 1 });
  const prisma = {
    notifications: { createMany },
    users: { findUnique: jest.fn().mockResolvedValue({ display_name: 'Jo' }) },
  } as any;
  const push = { sendToUser: jest.fn().mockResolvedValue(undefined) } as any;
  const moderation = {
    isBlockedEitherWay: jest.fn().mockResolvedValue(opts.blocked ?? false),
    isUserVisible: jest.fn().mockResolvedValue(opts.visible ?? true),
  } as any;
  return { createMany, push, moderation, service: new NotificationsService(prisma, push, moderation) };
}

describe('NotificationsService.notify', () => {
  it('writes nothing and pushes nothing when the recipient cannot see the actor', async () => {
    const { createMany, push, moderation, service } = setup({ visible: false });
    await service.notify({ recipientId: 'std', actorId: 'jr', type: 'FOLLOW' });
    expect(moderation.isUserVisible).toHaveBeenCalledWith('std', 'jr');
    expect(createMany).not.toHaveBeenCalled();
    expect(push.sendToUser).not.toHaveBeenCalled();
  });

  it('still notifies between accounts that can see each other', async () => {
    const { createMany, push, service } = setup({});
    await service.notify({ recipientId: 'std', actorId: 'jrpub', type: 'LIKE', postId: 'p1' });
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(push.sendToUser).toHaveBeenCalledTimes(1);
  });

  it('lets moderation warnings through regardless', async () => {
    const { createMany, push, moderation, service } = setup({ visible: false });
    await service.notify({ recipientId: 'jr', actorId: 'mod', type: 'WARNING', note: 'Be kind' });
    expect(moderation.isUserVisible).not.toHaveBeenCalled();
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(push.sendToUser).toHaveBeenCalledTimes(1);
  });
});
