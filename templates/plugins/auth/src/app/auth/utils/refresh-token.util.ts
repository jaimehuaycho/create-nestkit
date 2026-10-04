import { createHash, timingSafeEqual } from 'node:crypto';

// Refresh tokens are stored as a SHA-256 digest, NOT with bcrypt.
//
// bcrypt is meant for low-entropy secrets (passwords) and only uses the first 72 bytes of its input. A JWT is ~180
// bytes whose first 72 are the same for every token of a user (header + start of the payload), so a bcrypt hash of one
// refresh token matched ALL of them: rotated-out tokens kept working and reuse could never be detected. A refresh
// token is a long, signed, high-entropy value, so a fast full-length hash is the right tool, and it makes the
// comparison exact: only the very same token matches.
export const hashRefreshToken = (token: string): string =>
    createHash('sha256').update(token, 'utf8').digest('hex');

// Constant-time comparison of the presented token against the stored digest.
export const matchesRefreshToken = (token: string, storedDigest: string): boolean => {
    const presented = Buffer.from(hashRefreshToken(token), 'utf8');
    const stored    = Buffer.from(storedDigest, 'utf8');
    return presented.length === stored.length && timingSafeEqual(presented, stored);
};
