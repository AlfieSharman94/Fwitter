import { NotFoundException } from '@nestjs/common';
import { AgeTier } from '@prisma/client';
import { UsersService } from './users.service';
import { visibleUsersWhere } from './age-tier.util';

// expo-server-sdk (pulled in through the notifications and DM services) is ESM-only.
jest.mock('../notifications/push.service', () => ({ PushService: class {} }));

function setup(opts: { visible: boolean; tier: AgeTier }) {
  const follows = {
    create: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([]),
  };
  const users = {
    findUnique: jest.fn().mockResolvedValue({
      id: 'jr',
      username: 'jr',
      display_name: 'J',
      profile_image_url: null,
      created_at: new Date(),
      verified_at: null,
    }),
  };
  const prisma = { follows, users } as any;
  const moderation = {
    assertUserVisible: jest.fn(async () => {
      if (!opts.visible) throw new NotFoundException('user_not_found');
    }),
    assertCanInteract: jest.fn().mockResolvedValue(undefined),
    usersVisibleTo: jest.fn().mockResolvedValue(visibleUsersWhere(opts.tier)),
  } as any;
  const notifications = { notify: jest.fn(), remove: jest.fn() } as any;
  const dm = { eligibility: jest.fn() } as any;
  return { follows, notifications, service: new UsersService(prisma, notifications, moderation, dm) };
}

const author = { OR: [{ age_tier: { not: AgeTier.JUNIOR } }, { public_profile: true }] };

describe('UsersService.followUser', () => {
  it('refuses a target the viewer cannot see and writes nothing', async () => {
    const { follows, notifications, service } = setup({ visible: false, tier: AgeTier.STANDARD });
    await expect(service.followUser('std', 'jr')).rejects.toThrow(NotFoundException);
    expect(follows.create).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('follows a visible target as before', async () => {
    const { follows, service } = setup({ visible: true, tier: AgeTier.STANDARD });
    await expect(service.followUser('std', 'jrpub')).resolves.toEqual({ isFollowing: true, followersCount: 0, followingCount: 0 });
    expect(follows.create).toHaveBeenCalledWith({ data: { follower_id: 'std', following_id: 'jrpub' } });
  });
});

describe('UsersService.getPublicProfile', () => {
  it('answers not found for a private JUNIOR', async () => {
    const { service } = setup({ visible: false, tier: AgeTier.STANDARD });
    await expect(service.getPublicProfile('std', 'jr')).rejects.toThrow(NotFoundException);
  });
});

describe('UsersService.getFollowers / getFollowing', () => {
  it('answers not found for a target the viewer cannot see', async () => {
    const { service } = setup({ visible: false, tier: AgeTier.STANDARD });
    await expect(service.getFollowers('std', 'jr')).rejects.toThrow(NotFoundException);
    await expect(service.getFollowing('std', 'jr')).rejects.toThrow(NotFoundException);
  });

  it('leaves members a STANDARD viewer cannot see out of the lists', async () => {
    const { follows, service } = setup({ visible: true, tier: AgeTier.STANDARD });
    await service.getFollowers('std', 'club');
    await service.getFollowing('std', 'club');
    expect(follows.findMany.mock.calls[0][0].where).toEqual({ following_id: 'club', users_follows_follower_idTousers: author });
    expect(follows.findMany.mock.calls[1][0].where).toEqual({ follower_id: 'club', users_follows_following_idTousers: author });
  });

  it('filters nothing for a JUNIOR viewer', async () => {
    const { follows, service } = setup({ visible: true, tier: AgeTier.JUNIOR });
    await service.getFollowers('jr2', 'club');
    expect(follows.findMany.mock.calls[0][0].where).toEqual({ following_id: 'club' });
  });
});
