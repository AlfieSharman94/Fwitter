// Word-boundary matching for the banned-words list. Unicode-aware so accented
// letters count as letters, and "class" never matches "ass".

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildBannedPattern(words: string[]): RegExp | null {
  const cleaned = Array.from(new Set(words.map((w) => w.trim().toLowerCase()).filter(Boolean)));
  if (!cleaned.length) return null;
  const alternatives = cleaned.map(escapeRegex).join('|');
  return new RegExp(`(?:^|[^\\p{L}\\p{N}_])(?:${alternatives})(?![\\p{L}\\p{N}_])`, 'iu');
}

export function containsBannedWord(text: string, pattern: RegExp | null): boolean {
  return !!pattern && pattern.test(text);
}
