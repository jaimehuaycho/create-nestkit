import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { DEPENDENCY_RANGES } from './dependencies';
import { NEST } from './nest-version';
import { CORE_PROD_DEPENDENCIES, DB_DRIVERS, loadManifest, pinDep } from './generator';
import { PASSWORD_HASHERS } from './builders/password-hasher';

// Every package name the generator can install, from every source.
function allInstalledNames(): string[] {
    const plugins = fs.readdirSync(path.join(__dirname, '..', 'templates', 'plugins'));
    const names = new Set<string>(CORE_PROD_DEPENDENCIES);
    for (const id of plugins) {
        const { dependencies } = loadManifest(id);
        [...dependencies.prod, ...dependencies.dev].forEach(n => names.add(n));
    }
    for (const driver of Object.values(DB_DRIVERS)) [...driver.prod, ...driver.dev].forEach(n => names.add(n));
    for (const hasher of Object.values(PASSWORD_HASHERS)) [...hasher.dependencies.prod, ...hasher.dependencies.dev].forEach(n => names.add(n));
    return [...names].sort();
}

describe('dependency version ranges', () => {
    it('every package the generator installs has a range (nothing resolves to a bare latest)', () => {
        for (const name of allInstalledNames()) {
            expect(() => pinDep(name), name).not.toThrow();
        }
    });

    it('has no dead entries: every range belongs to something the generator really installs', () => {
        const installed = new Set(allInstalledNames());
        for (const name of Object.keys(DEPENDENCY_RANGES)) {
            expect(installed.has(name), `${name} is pinned but never installed`).toBe(true);
        }
    });

    it('@nestjs/* packages are pinned by the Nest profile, never by this table', () => {
        // Not coupled to the Nest major: observe (0.x) and throttler (6.x) have their own version lines.
        const OWN_VERSION_LINE = ['@nestjs/observe', '@nestjs/throttler', '@nestjs/mail'];
        for (const name of Object.keys(DEPENDENCY_RANGES)) {
            if (name.startsWith('@nestjs/') && !OWN_VERSION_LINE.some(own => name.startsWith(own))) {
                throw new Error(`${name} belongs in NEST.packages`);
            }
        }
        for (const name of Object.keys(NEST.packages)) expect(DEPENDENCY_RANGES[name]).toBeUndefined();
    });

    it('pins a major (caret), and a minor for 0.x packages where the minor is the breaking level', () => {
        for (const [name, range] of Object.entries(DEPENDENCY_RANGES)) {
            expect(range, name).toMatch(/^\^\d+(\.\d+){0,2}$/);
            if (range.startsWith('^0.0.')) expect(range, `${name} is 0.0.x: the caret is an exact pin`).toMatch(/^\^0\.0\.\d+$/);
            else if (range.startsWith('^0.')) expect(range, `${name} is 0.x: pin the minor`).toMatch(/^\^0\.\d+$/);
        }
    });

    it('does not install packages that are deprecated or already bundled', () => {
        const names = allInstalledNames();
        expect(names).not.toContain('swagger-ui-express');   // @nestjs/swagger 12 bundles swagger-ui-dist
        expect(names).not.toContain('@types/socket.io');     // deprecated stub: socket.io ships its own types
        expect(names).not.toContain('@types/nodemailer');    // nodemailer 10 ships its own types
    });
});
