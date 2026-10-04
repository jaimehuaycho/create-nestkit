import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import {
    PASSWORD_HASHERS, DEFAULT_PASSWORD_HASHER, getPasswordHasher, writePasswordUtil, PasswordHasherId,
} from './password-hasher';

const IDS = Object.keys(PASSWORD_HASHERS) as PasswordHasherId[];

describe('password hasher registry', () => {
    it('offers bcrypt and Argon2id, with bcrypt as the default', () => {
        expect(IDS.sort()).toEqual(['argon2', 'bcrypt']);
        expect(DEFAULT_PASSWORD_HASHER).toBe('bcrypt');
        expect(PASSWORD_HASHERS.argon2.label).toBe('Argon2id');
    });

    it('falls back to the default for an unknown or missing id', () => {
        expect(getPasswordHasher(undefined).id).toBe('bcrypt');
        expect(getPasswordHasher('nope').id).toBe('bcrypt');
        expect(getPasswordHasher('argon2').id).toBe('argon2');
    });

    it.each(IDS)('%s: every package with an install script is declared as a dependency', (id) => {
        const h = PASSWORD_HASHERS[id];
        for (const pkg of h.allowScripts) expect(h.dependencies.prod).toContain(pkg);
    });

    it('installs only the chosen library: bcrypt brings its types, argon2 ships its own', () => {
        expect(PASSWORD_HASHERS.bcrypt.dependencies).toEqual({ prod: ['bcrypt'], dev: ['@types/bcrypt'] });
        expect(PASSWORD_HASHERS.argon2.dependencies).toEqual({ prod: ['argon2'], dev: [] });
    });

    it.each(IDS)('%s: the generated source exports the same API and its limit matches the registry', (id) => {
        const h = PASSWORD_HASHERS[id];
        for (const name of ['hashPassword', 'comparePassword']) {
            expect(h.source, name).toMatch(new RegExp(`export const ${name} = async`));
        }
        const limit = /export const PASSWORD_MAX_BYTES = (\d+);/.exec(h.source)?.[1];
        expect(Number(limit)).toBe(h.maxBytes);
    });

    it('bcrypt keeps the 72-byte limit; Argon2 has no truncation, only a guard', () => {
        expect(PASSWORD_HASHERS.bcrypt.maxBytes).toBe(72);
        expect(PASSWORD_HASHERS.bcrypt.source).toContain("from 'bcrypt'");
        expect(PASSWORD_HASHERS.bcrypt.source).toContain('SALT_ROUNDS = 10');
        expect(PASSWORD_HASHERS.argon2.maxBytes).toBeGreaterThan(72);
        expect(PASSWORD_HASHERS.argon2.source).toContain("from 'argon2'");
        expect(PASSWORD_HASHERS.argon2.source).toContain('argon2.argon2id');
    });

    it('argon2 treats a malformed stored hash as "no match" instead of throwing', () => {
        expect(PASSWORD_HASHERS.argon2.source).toMatch(/catch \{[\s\S]*return false;/);
    });
});

describe('writePasswordUtil', () => {
    let dir: string;
    afterEach(() => { if (dir) fs.rmSync(dir, { recursive: true, force: true }); });

    it.each(IDS)('writes src/shared/security/password.util.ts for %s', (id) => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hasher-'));
        writePasswordUtil(dir, PASSWORD_HASHERS[id]);
        const written = fs.readFileSync(path.join(dir, 'src', 'shared', 'security', 'password.util.ts'), 'utf-8');
        expect(written).toBe(PASSWORD_HASHERS[id].source);
    });
});
