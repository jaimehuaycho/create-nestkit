import { createHash, randomBytes } from 'node:crypto';

// Refresh tokens are opaque: 256 random bits, not a JWT. They are stored as a SHA-256 digest, never bcrypt: a random token
// has full entropy, so a fast hash is enough and the comparison is exact.
export const generateRefreshToken = (): string => randomBytes(32).toString('base64url');

export const hashRefreshToken = (token: string): string => createHash('sha256').update(token, 'utf8').digest('hex');
