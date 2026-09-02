import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { loadManifest, resolvePlugins, pinDep, generateProject, Manifest } from './generator';
import { SUPPORTED_NEST_VERSIONS } from './nest-version';

const PLUGINS_DIR = path.join(__dirname, '..', 'templates', 'plugins');
const ALL_PLUGIN_IDS = fs.readdirSync(PLUGINS_DIR);

describe('loadManifest', () => {
    it('loads every plugin manifest as valid JSON matching the Manifest shape', () => {
        for (const id of ALL_PLUGIN_IDS) {
            const manifest = loadManifest(id);
            expect(manifest.id).toBe(id);
            expect(Array.isArray(manifest.requires)).toBe(true);
            expect(Array.isArray(manifest.appModule.imports)).toBe(true);
            expect(Array.isArray(manifest.appModule.modules)).toBe(true);
            expect(Array.isArray(manifest.dependencies.prod)).toBe(true);
            expect(Array.isArray(manifest.dependencies.dev)).toBe(true);
        }
    });

    it('every manifest-declared relative appModule import ends in .js (ESM-safe)', () => {
        for (const id of ALL_PLUGIN_IDS) {
            for (const line of loadManifest(id).appModule.imports) {
                const match = line.match(/from\s+'(\.[^']+)'/);
                if (match) expect(match[1]).toMatch(/\.js$/);
            }
        }
    });

    it('every id a manifest declares in "requires" actually exists as a plugin', () => {
        for (const id of ALL_PLUGIN_IDS) {
            for (const dep of loadManifest(id).requires) {
                expect(ALL_PLUGIN_IDS).toContain(dep);
            }
        }
    });

    it('observe declares minNestMajor 12 (the @nestjs/observe package does not exist before v12)', () => {
        expect(loadManifest('observe').minNestMajor).toBe(12);
    });
});

describe('generateProject — minNestMajor guard', () => {
    it('rejects before touching the filesystem when a selected plugin needs a newer Nest major', async () => {
        const targetDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nestkit-guard-')), 'my-api');

        await expect(generateProject({
            projectName: 'my-api',
            plugins:     ['observe'],
            dbDriver:    'postgres',
            targetDir,
            nestVersion: SUPPORTED_NEST_VERSIONS[11], // observe needs 12+
        })).rejects.toThrow(/observe.*requires NestJS 12\+.*v11/);

        expect(fs.existsSync(targetDir)).toBe(false);
    });
});

describe('resolvePlugins', () => {
    it('returns an empty array when nothing is selected', () => {
        expect(resolvePlugins([])).toEqual([]);
    });

    it('leaves a dependency-free plugin as-is', () => {
        expect(resolvePlugins(['mailer'])).toEqual(['mailer']);
    });

    it('resolves auth to its full transitive chain in dependency order', () => {
        // auth requires [database, users, roles] — each must appear before its dependent,
        // and before anything that depends on it.
        expect(resolvePlugins(['auth'])).toEqual(['database', 'users', 'roles', 'auth']);
    });

    it('does not duplicate a plugin pulled in both directly and transitively', () => {
        const resolved = resolvePlugins(['database', 'auth']);
        expect(resolved.filter(id => id === 'database')).toHaveLength(1);
        expect(resolved).toEqual(['database', 'users', 'roles', 'auth']);
    });

    it('combines independent plugin selections without cross-contamination', () => {
        const resolved = resolvePlugins(['socket', 'pdf']);
        expect(resolved).toEqual(['socket', 'pdf']);
    });
});

describe('pinDep', () => {
    const v11 = SUPPORTED_NEST_VERSIONS[11];
    const v12 = SUPPORTED_NEST_VERSIONS[12];

    it('pins a tightly-coupled @nestjs/* package to the version matching the resolved major', () => {
        expect(pinDep('@nestjs/swagger', v11)).toBe('@nestjs/swagger@^11');
        expect(pinDep('@nestjs/swagger', v12)).toBe('@nestjs/swagger@^12');
    });

    it('leaves an unlisted package name bare so npm resolves it to latest', () => {
        expect(pinDep('typeorm', v11)).toBe('typeorm');
        expect(pinDep('bcrypt', v12)).toBe('bcrypt');
    });
});
