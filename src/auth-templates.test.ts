import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { generateRefreshToken, hashRefreshToken } from '../templates/plugins/auth/src/app/auth/utils/token.util';
import { decryptSecret, encryptSecret } from '../templates/plugins/auth/src/app/auth/utils/secret-box.util';
import { hasAnyRole } from '../templates/plugins/auth/src/app/auth/utils/roles.util';
import { parseDuration } from '../templates/core/src/shared/utils/duration.util';
import { byteLength } from '../templates/core/src/shared/utils/bytes.util';
import { PASSWORD_HASHERS } from './builders/password-hasher';

// Tests for the security-sensitive code the auth plugin generates into users' projects.
const TEMPLATES = path.join(__dirname, '..', 'templates');
const read = (rel: string) => fs.readFileSync(path.join(TEMPLATES, rel), 'utf-8');

function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
        e.isDirectory() ? sourceFiles(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []);
}

describe('refresh tokens', () => {
    it('are opaque, 256 random bits, and never repeat', () => {
        const a = generateRefreshToken();
        expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(generateRefreshToken()).not.toBe(a);
    });

    it('are stored as a SHA-256 digest: 64 hex characters, deterministic, different per token', () => {
        const t = generateRefreshToken();
        expect(hashRefreshToken(t)).toMatch(/^[0-9a-f]{64}$/);
        expect(hashRefreshToken(t)).toBe(hashRefreshToken(t));
        expect(hashRefreshToken(t)).not.toBe(hashRefreshToken(generateRefreshToken()));
    });
});

describe('secret box (TOTP secrets at rest)', () => {
    const key = Buffer.alloc(32, 7);

    it('round-trips a secret and never stores it in the clear', () => {
        const boxed = encryptSecret('JBSWY3DPEHPK3PXP', key);
        expect(boxed).not.toContain('JBSWY3DPEHPK3PXP');
        expect(decryptSecret(boxed, key)).toBe('JBSWY3DPEHPK3PXP');
    });

    it('uses a fresh IV each time', () => {
        expect(encryptSecret('x', key)).not.toBe(encryptSecret('x', key));
    });

    it('refuses a tampered value, another key, or an unknown format', () => {
        const boxed = encryptSecret('secret', key);
        const [v, iv, tag, data] = boxed.split('.');
        expect(() => decryptSecret([v, iv, tag, Buffer.from('tampered').toString('base64url')].join('.'), key)).toThrow();
        expect(() => decryptSecret(boxed, Buffer.alloc(32, 8))).toThrow();
        expect(() => decryptSecret(`v9.${iv}.${tag}.${data}`, key)).toThrow(/Unsupported/);
        expect(() => decryptSecret('garbage', key)).toThrow();
    });
});

describe('role check', () => {
    const user = (...roles: string[]) => ({ id: 1, roles });

    it('allows a user holding ANY of the listed roles, and nobody else', () => {
        expect(hasAnyRole(user('admin'), 'root', 'admin')).toBe(true);
        expect(hasAnyRole(user('user'), 'root', 'admin')).toBe(false);
        expect(hasAnyRole(user(), 'root')).toBe(false);
        expect(hasAnyRole(null, 'root')).toBe(false);
    });

    it('has no hierarchy: a higher role does not imply a lower one', () => {
        expect(hasAnyRole(user('root'), 'user')).toBe(false);
    });
});

describe('parseDuration', () => {
    it('reads the units the env variables use', () => {
        expect(parseDuration('30s')).toBe(30_000);
        expect(parseDuration('15m')).toBe(900_000);
        expect(parseDuration('7d')).toBe(604_800_000);
        expect(parseDuration(1500)).toBe(1500);
    });

    it('fails on a typo instead of guessing, so a bad .env stops at startup', () => {
        expect(() => parseDuration('15 minutes')).toThrow(/Invalid duration/);
        expect(() => parseDuration('')).toThrow();
    });
});

describe('byteLength / password limit', () => {
    it('counts UTF-8 bytes, not characters', () => {
        expect(byteLength('abc')).toBe(3);
        expect(byteLength('😀')).toBe(4);
        expect(byteLength('ñ')).toBe(2);
    });

    it('a password under 72 characters can still exceed 72 bytes', () => {
        const emojis = '😀'.repeat(20);                     // 20 characters
        const bcryptMax = PASSWORD_HASHERS.bcrypt.maxBytes;
        expect(emojis.length).toBeLessThan(bcryptMax);
        expect(byteLength(emojis)).toBeGreaterThan(bcryptMax);
    });
});

describe('auth plugin wiring', () => {
    it('public sign-up never takes a role (anyone could otherwise register as root)', () => {
        const dto = read('plugins/auth/src/app/auth/dto/register.dto.ts').split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
        expect(dto).not.toMatch(/\brole(Id|Name|s)?\b\s*[?:]/);
        expect(dto).not.toMatch(/@Is(Int|Enum)/);
    });

    it.each([
        'plugins/auth/src/app/auth/dto/login.dto.ts',
        'plugins/auth/src/app/auth/dto/register.dto.ts',
        'plugins/users/src/modules/users/dto/create-user.dto.ts',
    ])('%s limits the password in BYTES through the hasher\'s PASSWORD_MAX_BYTES, not 255 characters', (file) => {
        const dto = read(file);
        expect(dto).toContain('@MaxBytes(PASSWORD_MAX_BYTES');
        expect(dto).toContain('shared/security/password.util.js');
        expect(dto).not.toContain('BCRYPT');
        expect(dto).not.toMatch(/@MaxLength\(255\)\s*\n\s*password/);
    });

    it('a role is never a string literal in generated code: RoleEnum is the only place it is written', () => {
        for (const file of sourceFiles(path.join(TEMPLATES, 'core')).concat(sourceFiles(path.join(TEMPLATES, 'plugins')))) {
            if (file.endsWith(path.join('shared', 'enums', 'role.enum.ts'))) continue;
            const hits = fs.readFileSync(file, 'utf-8').split('\n')
                .filter(line => !line.trim().startsWith('//') && !line.trim().startsWith('*') && /['"](root|admin)['"]/.test(line));
            expect(hits, path.relative(TEMPLATES, file)).toEqual([]);
        }
    });
});
