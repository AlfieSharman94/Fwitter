import { AgeTier } from '@prisma/client';
import { SearchService } from './search.service';
import { visibleUsersWhere } from '../users/age-tier.util';

function setup(tier: AgeTier, blocked: string[] = []) {
  const findMany = jest.fn().mockResolvedValue([]);
  const prisma = { users: { findMany }, follows: { findMany: jest.fn().mockResolvedValue([]) } } as any;
  const moderation = {
    blockedIds: jest.fn().mockResolvedValue(blocked),
    usersVisibleTo: jest.fn().mockResolvedValue(visibleUsersWhere(tier)),
  } as any;
  return { findMany, service: new SearchService(prisma, moderation) };
}

const nameMatch = [
  { username: { contains: 'al', mode: 'insensitive' } },
  { display_name: { contains: 'al', mode: 'insensitive' } },
];

describe('SearchService.searchUsers', () => {
  it('leaves private JUNIORs out for a STANDARD viewer, on top of blocks', async () => {
    const { findMany, service } = setup(AgeTier.STANDARD, ['b1']);
    await service.searchUsers('viewer', 'al');
    expect(findMany.mock.calls[0][0].where).toEqual({
      OR: nameMatch,
      id: { notIn: ['b1'] },
      AND: [{ OR: [{ age_tier: { not: AgeTier.JUNIOR } }, { public_profile: true }] }],
    });
  });

  it('adds no tier condition for a JUNIOR viewer', async () => {
    const { findMany, service } = setup(AgeTier.JUNIOR);
    await service.searchUsers('viewer', 'al');
    expect(findMany.mock.calls[0][0].where).toEqual({ OR: nameMatch });
  });
});
