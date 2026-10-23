import { buildBannedPattern, containsBannedWord } from './banned-words';

describe('banned words', () => {
  const pattern = buildBannedPattern(['badword', 'Other Phrase', 'ass']);

  it('matches whole words case-insensitively', () => {
    expect(containsBannedWord('what a BADWORD that was', pattern)).toBe(true);
    expect(containsBannedWord('badword', pattern)).toBe(true);
    expect(containsBannedWord('other phrase!', pattern)).toBe(true);
  });

  it('does not match inside other words', () => {
    expect(containsBannedWord('class assignment passes', pattern)).toBe(false);
    expect(containsBannedWord('badwords', pattern)).toBe(false);
    expect(containsBannedWord('xbadword', pattern)).toBe(false);
  });

  it('treats accented letters as letters', () => {
    expect(containsBannedWord('éass', pattern)).toBe(false);
    expect(containsBannedWord('ass.', pattern)).toBe(true);
  });

  it('is empty-safe', () => {
    expect(buildBannedPattern([])).toBeNull();
    expect(containsBannedWord('anything', null)).toBe(false);
    expect(buildBannedPattern(['  ', ''])).toBeNull();
  });

  it('escapes regex characters in words', () => {
    const p = buildBannedPattern(['a.b']);
    expect(containsBannedWord('a.b', p)).toBe(true);
    expect(containsBannedWord('axb', p)).toBe(false);
  });
});
