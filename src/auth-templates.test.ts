import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { hashRefreshToken, matchesRefreshToken } from '../templates/plugins/auth/src/app/auth/utils/refresh-token.util';
import { byteLength, BCRYPT_MAX_BYTES } from '../templates/core/src/shared/utils/bytes.util';

// Tests for the security-sensitive code the auth plugin generates into users' projects.
const TEMPLATES = path.join(__dirname, '..', 'templates');
const read = (rel: string) => fs.readFileSync(path.join(TEMPLATES, rel), 'utf-8');

// A realistic refresh token: header.payload.signature. Two tokens of the same user share the first ~72 bytes.
const header  = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
const token = (iat: number, jti: string) =>
    `${header}.${Buffer.from(JSON.stringify({ sub: 1, email: 'root@app.com', roleId: 1, iat, exp: iat + 604800, jti })).toString('base64url')}.sig${iat}${jti}`;

describe('refresh token digest', () => {
    it('matches the exact token that was stored', () => {
        const t = token(1700000000, 'a');
        expect(matchesRefreshToken(t, hashRefreshToken(t))).toBe(true);
    });

    it('does NOT match a different token of the same user (the bcrypt 72-byte truncation bug)', () => {
        const old = token(1700000000, 'a');
        const next = token(1700000001, 'b');
        // Prove the premise of the bug: both tokens agree on their first 72 bytes.
        expect(next.slice(0, 72)).toBe(old.slice(0, 72));
        expect(next).not.toBe(old);

        expect(matchesRefreshToken(next, hashRefreshToken(old))).toBe(false);
    });

    it('is a 64-char hex digest (fits the refresh_token column) and is deterministic', () => {
        const t = token(1700000000, 'a');
        expect(hashRefreshToken(t)).toMatch(/^[0-9a-f]{64}$/);
        expect(hashRefreshToken(t)).toBe(hashRefreshToken(t));
    });

    it('rejects a malformed or empty stored value instead of throwing', () => {
        expect(matchesRefreshToken(token(1, 'a'), '')).toBe(false);
        expect(matchesRefreshToken(token(1, 'a'), 'not-a-digest')).toBe(false);
    });
});

describe('byteLength / bcrypt limit', () => {
    it('counts UTF-8 bytes, not characters', () => {
        expect(byteLength('abc')).toBe(3);
        expect(byteLength('😀')).toBe(4);
        expect(byteLength('ñ')).toBe(2);
    });

    it('a password under 72 characters can still exceed 72 bytes', () => {
        const emojis = '😀'.repeat(20);                     // 20 characters
        expect(emojis.length).toBeLessThan(BCRYPT_MAX_BYTES);
        expect(byteLength(emojis)).toBeGreaterThan(BCRYPT_MAX_BYTES);
    });
});

describe('auth plugin wiring', () => {
    const authService = read('plugins/auth/src/app/auth/services/auth.service.ts');

    it('no longer hashes refresh tokens with bcrypt', () => {
        expect(authService).not.toMatch(/hashPassword\(\s*refreshToken/);
        expect(authService).not.toMatch(/comparePassword\(\s*dto\.refreshToken/);
        expect(authService).toContain('hashRefreshToken(refreshToken)');
        expect(authService).toContain('matchesRefreshToken(dto.refreshToken');
    });

    it('gives every refresh token a unique jti', () => {
        expect(authService).toMatch(/jwtid:\s*randomUUID\(\)/);
    });

    it.each([
        'plugins/auth/src/app/auth/dto/login.dto.ts',
        'plugins/auth/src/app/auth/dto/register.dto.ts',
        'plugins/users/src/modules/users/dto/create-user.dto.ts',
        'plugins/users/src/modules/users/dto/update-user.dto.ts',
    ])('%s limits the password to 72 bytes, not 255 characters', (file) => {
        const dto = read(file);
        expect(dto).toContain('@MaxBytes(BCRYPT_MAX_BYTES');
        expect(dto).not.toMatch(/@MaxLength\(255\)\s*\n\s*password/);
    });
});
