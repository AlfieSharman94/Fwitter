import { createHash } from 'crypto';
import { CONSENT_TOKEN_TTL_MS, createConsentToken, hashConsentToken, isConsentTokenShape } from './consent-token';

const NOW = new Date(Date.UTC(2026, 9, 23, 12, 0, 0));

describe('consent token', () => {
  it('is 43 url-safe characters and differs per call', () => {
    const a = createConsentToken(NOW);
    const b = createConsentToken(NOW);
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isConsentTokenShape(a.token)).toBe(true);
    expect(a.token).not.toBe(b.token);
  });

  it('stores a sha256 hex hash of the token, never the token', () => {
    const { token, hash } = createConsentToken(NOW);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(hash).toBe(hashConsentToken(token));
    expect(hash).not.toContain(token);
  });

  it('expires exactly 7 days after issue', () => {
    const { expiresAt } = createConsentToken(NOW);
    expect(expiresAt.getTime() - NOW.getTime()).toBe(CONSENT_TOKEN_TTL_MS);
    expect(expiresAt.toISOString()).toBe('2026-10-30T12:00:00.000Z');
  });

  it('rejects tokens of the wrong shape before any lookup', () => {
    expect(isConsentTokenShape('')).toBe(false);
    expect(isConsentTokenShape('short')).toBe(false);
    expect(isConsentTokenShape('a'.repeat(42))).toBe(false);
    expect(isConsentTokenShape('a'.repeat(44))).toBe(false);
    expect(isConsentTokenShape('a'.repeat(42) + '/')).toBe(false);
    expect(isConsentTokenShape('a'.repeat(42) + '=')).toBe(false);
  });
});
