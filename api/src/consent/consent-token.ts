import { createHash, randomBytes } from 'crypto';

export const CONSENT_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// 32 random bytes as base64url: 43 characters, URL safe, unguessable. Only the SHA-256 hex
// digest is stored, so a database read never yields a usable link.
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

export function hashConsentToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isConsentTokenShape(token: string): boolean {
  return TOKEN_SHAPE.test(token);
}

export function createConsentToken(now: Date = new Date()): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashConsentToken(token), expiresAt: new Date(now.getTime() + CONSENT_TOKEN_TTL_MS) };
}
