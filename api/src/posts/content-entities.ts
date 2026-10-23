// Pulls @mentions and #hashtags out of post content at creation time.
// A token only counts when it starts a word: "joe@example.com" is not a
// mention and "##x" / "a#b" are not hashtags. Mentions must be valid usernames
// (2-30 chars, letters/digits/underscore); hashtags start with a letter and
// are at most 50 chars, matching the hashtags.tag column.

const MENTION = /(^|[^A-Za-z0-9_@#])@([A-Za-z0-9_]{2,30})(?![A-Za-z0-9_])/g;
const HASHTAG = /(^|[^A-Za-z0-9_@#])#([A-Za-z][A-Za-z0-9_]{0,49})(?![A-Za-z0-9_])/g;

// Usernames as written, de-duplicated case-insensitively (first spelling wins).
// Lookups are case-insensitive, so spelling does not matter for resolution.
export function extractMentions(content: string): string[] {
  const seen = new Map<string, string>();
  for (const match of content.matchAll(MENTION)) {
    const name = match[2];
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  }
  return [...seen.values()];
}

// Lowercased, de-duplicated, in order of first appearance.
export function extractHashtags(content: string): string[] {
  const tags = new Set<string>();
  for (const match of content.matchAll(HASHTAG)) {
    tags.add(match[2].toLowerCase());
  }
  return [...tags];
}
