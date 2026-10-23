import { extractHashtags, extractMentions } from './content-entities';

describe('extractMentions', () => {
  it('finds mentions and de-duplicates case-insensitively, keeping the first spelling', () => {
    expect(extractMentions('hi @Alice and @bob, @alice again')).toEqual(['Alice', 'bob']);
  });

  it('ignores email addresses and mid-word @', () => {
    expect(extractMentions('mail joe@example.com or x@y')).toEqual([]);
  });

  it('enforces username length (2-30)', () => {
    expect(extractMentions('@a @ab')).toEqual(['ab']);
    expect(extractMentions('@' + 'x'.repeat(31))).toEqual([]);
    expect(extractMentions('@' + 'x'.repeat(30))).toEqual(['x'.repeat(30)]);
  });

  it('stops at punctuation and handles start of string', () => {
    expect(extractMentions('@sam: great take! (@jo)')).toEqual(['sam', 'jo']);
  });
});

describe('extractHashtags', () => {
  it('lowercases and de-duplicates', () => {
    expect(extractHashtags('#Arsenal #arsenal #COYG!')).toEqual(['arsenal', 'coyg']);
  });

  it('requires a leading letter and a word boundary before #', () => {
    expect(extractHashtags('##double #1abc a#b #ok_1')).toEqual(['ok_1']);
  });

  it('rejects tags longer than 50 chars', () => {
    expect(extractHashtags('#' + 'a'.repeat(51))).toEqual([]);
    expect(extractHashtags('#' + 'a'.repeat(50))).toEqual(['a'.repeat(50)]);
  });

  it('returns nothing for plain text', () => {
    expect(extractHashtags('no tags here')).toEqual([]);
  });
});
