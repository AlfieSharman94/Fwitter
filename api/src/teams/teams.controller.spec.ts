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
});
