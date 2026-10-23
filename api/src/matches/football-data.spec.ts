import { normaliseTeamName, toMatchStatus } from './football-data';

describe('normaliseTeamName', () => {
  it.each([
    ['Arsenal FC', 'Arsenal'],
    ['Manchester City FC', 'Manchester City'],
    ['Tottenham Hotspur FC', 'Tottenham Hotspur'],
    ['Real Madrid CF', 'Real Madrid'],
    ['FC Barcelona', 'FC Barcelona'],
    ['Club Atlético de Madrid', 'Atlético de Madrid'],
    ['Juventus FC', 'Juventus'],
    ['FC Internazionale Milano', 'Inter'],
    ['AC Milan', 'AC Milan'],
    ['SSC Napoli', 'Napoli'],
    ['FC Bayern München', 'Bayern Munich'],
    ['Borussia Dortmund', 'Borussia Dortmund'],
  ])('maps the API name %s onto the seeded team %s', (apiName, seeded) => {
    expect(normaliseTeamName(apiName)).toBe(normaliseTeamName(seeded));
  });

  it('does not collapse different clubs together', () => {
    expect(normaliseTeamName('Manchester United FC')).not.toBe(normaliseTeamName('Manchester City FC'));
    expect(normaliseTeamName('Inter')).not.toBe(normaliseTeamName('AC Milan'));
  });
});

describe('toMatchStatus', () => {
  it('passes known statuses through and defaults unknown ones', () => {
    expect(toMatchStatus('IN_PLAY')).toBe('IN_PLAY');
    expect(toMatchStatus('PENALTY_SHOOTOUT')).toBe('PENALTY_SHOOTOUT');
    expect(toMatchStatus('LIVE')).toBe('SCHEDULED');
    expect(toMatchStatus('')).toBe('SCHEDULED');
  });
});
