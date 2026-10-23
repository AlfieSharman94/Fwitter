import { TeamsController } from './teams.controller';

const team = (name: string, country: string, league: string) => ({
  id: name.toLowerCase().replace(/\W+/g, '-'),
  name,
  logo_url: null,
  league,
  country,
});

function controllerWith(rows: ReturnType<typeof team>[]) {
  const findMany = jest.fn().mockResolvedValue(rows);
  const prisma = { teams: { findMany } } as any;
  return { controller: new TeamsController(prisma), findMany };
}

describe('TeamsController', () => {
  it('search returns league and country alongside the name', async () => {
    const { controller, findMany } = controllerWith([team('Inter', 'Italy', 'Serie A')]);

    const result = await controller.search('inter');

    expect(result.teams[0]).toMatchObject({ name: 'Inter', league: 'Serie A', country: 'Italy' });
    expect(findMany.mock.calls[0][0].select).toMatchObject({ league: true, country: true });
  });

  it('featured lists the Premier League, then the Championship, then European clubs', async () => {
    // Alphabetical, as the database returns them.
    const { controller, findMany } = controllerWith([
      team('AC Milan', 'Italy', 'Serie A'),
      team('Arsenal', 'England', 'Premier League'),
      team('Birmingham City', 'England', 'Championship'),
      team('Celtic', 'Scotland', 'Scottish Premiership'),
      team('Chelsea', 'England', 'Premier League'),
      team('Wrexham', 'England', 'Championship'),
    ]);

    const result = await controller.featured();

    expect(result.teams.map((t) => t.name)).toEqual([
      'Arsenal',
      'Chelsea',
      'Birmingham City',
      'Wrexham',
      'AC Milan',
      'Celtic',
    ]);
    expect(findMany.mock.calls[0][0].where.OR).toEqual(
      expect.arrayContaining([
        { country: 'England', league: 'Premier League' },
        { country: 'England', league: 'Championship' },
        { name: { in: expect.arrayContaining(['Real Madrid', 'Celtic']) } },
      ]),
    );
  });

  it("suggested lists the viewer's clubs first, then the rest of their leagues", async () => {
    const own = [team('FC Barcelona', 'Spain', 'La Liga'), team('Manchester City', 'England', 'Premier League')];
    // Alphabetical, as the database returns them; expected back grouped by league.
    const findMany = jest
      .fn()
      .mockResolvedValue([
        team('Arsenal', 'England', 'Premier League'),
        team('Real Madrid', 'Spain', 'La Liga'),
        team('Sevilla', 'Spain', 'La Liga'),
      ]);
    const prisma = {
      users: { findUnique: jest.fn().mockResolvedValue({ id: 'u1' }) },
      user_teams: { findMany: jest.fn().mockResolvedValue(own.map((t) => ({ teams: t }))) },
      teams: { findMany },
    } as any;

    const result = await new TeamsController(prisma).suggested({ sub: 'sub-1' });

    expect(result.teams.map((t) => t.name)).toEqual(['FC Barcelona', 'Manchester City', 'Real Madrid', 'Sevilla', 'Arsenal']);
    expect(findMany.mock.calls[0][0].where).toEqual({
      OR: [
        { league: 'La Liga', country: 'Spain' },
        { league: 'Premier League', country: 'England' },
      ],
      id: { notIn: ['fc-barcelona', 'manchester-city'] },
    });
  });

  it('suggested is empty for a profile without clubs', async () => {
    const findMany = jest.fn();
    const prisma = {
      users: { findUnique: jest.fn().mockResolvedValue({ id: 'u1' }) },
      user_teams: { findMany: jest.fn().mockResolvedValue([]) },
      teams: { findMany },
    } as any;

    const result = await new TeamsController(prisma).suggested({ sub: 'sub-1' });

    expect(result.teams).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
