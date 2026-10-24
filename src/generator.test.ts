import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { loadManifest, resolvePlugins, pinDep, generateProject, driverDependencies, DB_DRIVERS, Manifest } from './generator';
import { NEST } from './nest-version';

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

});

describe('generateProject — input guards', () => {
    const base = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nestkit-input-'));

    it('rejects a project name that would reach the shell, before doing any work', async () => {
        const dir = base();
        const marker = path.join(dir, 'pwned');

        await expect(generateProject({
            projectName: `x; touch ${marker}`,
            plugins:     [],
            dbDriver:    'postgres',
            targetDir:   path.join(dir, 'x'),
        })).rejects.toThrow(/letters, numbers/);

        expect(fs.existsSync(marker)).toBe(false);
    });

    it('rejects when the target directory already exists, leaving it untouched', async () => {
        const targetDir = base();
        fs.writeFileSync(path.join(targetDir, 'keep.txt'), 'mine');

        await expect(generateProject({
            projectName: 'my-api',
            plugins:     [],
            dbDriver:    'postgres',
            targetDir,
        })).rejects.toThrow(/already exists/);

        expect(fs.readFileSync(path.join(targetDir, 'keep.txt'), 'utf-8')).toBe('mine');
    });
});

describe('manifest allowScripts', () => {
    it('is a list of package names where declared, and the pdf plugin declares puppeteer (Chrome download)', () => {
        for (const id of ['database', 'auth', 'mailer', 'socket', 'pdf', 'observe', 'users', 'roles']) {
            const { allowScripts } = loadManifest(id);
            if (allowScripts !== undefined) expect(allowScripts.every(n => typeof n === 'string' && n.length > 0)).toBe(true);
        }
        expect(loadManifest('pdf').allowScripts).toContain('puppeteer');
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
    it('pins a tightly-coupled @nestjs/* package to the target Nest major', () => {
        expect(pinDep('@nestjs/swagger')).toBe(`@nestjs/swagger@^${NEST.major}`);
        expect(pinDep('@nestjs/typeorm')).toBe(`@nestjs/typeorm@^${NEST.major}`);
    });

    it('pins every other dependency to the major the templates were verified against', () => {
        expect(pinDep('typeorm')).toBe('typeorm@^1');
        expect(pinDep('joi')).toBe('joi@^18');
        expect(pinDep('argon2')).toBe('argon2@^0.45');
    });

    it('refuses an unknown package instead of installing a bare name (a surprise major)', () => {
        expect(() => pinDep('left-pad')).toThrow(/No version range for "left-pad"/);
    });
});

describe('driverDependencies', () => {
    it('installs the driver only when the Database plugin is selected', () => {
        expect(driverDependencies(['database'], DB_DRIVERS.postgres)).toEqual({ prod: ['pg'], dev: [] });
        expect(driverDependencies(['database', 'users', 'auth'], DB_DRIVERS.mysql)).toEqual({ prod: ['mysql2'], dev: [] });
    });

    it('installs no driver for a project without a database, whatever engine is the default', () => {
        for (const engine of Object.values(DB_DRIVERS)) {
            expect(driverDependencies([], engine)).toEqual({ prod: [], dev: [] });
            expect(driverDependencies(['mailer', 'socket'], engine)).toEqual({ prod: [], dev: [] });
        }
    });
});
