import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import { addPluginScripts, addInstallScriptPolicy } from './package-json';
import { Manifest } from '../generator';

function fakeManifest(scripts: Record<string, string>): Manifest {
    return {
        id: 'fake',
        requires: [],
        appModule: { imports: [], modules: [] },
        dependencies: { prod: [], dev: [] },
        scripts,
    };
}

describe('addPluginScripts', () => {
    let tmpDir: string;

    afterEach(() => {
        if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('merges every manifest script into package.json without touching existing ones', () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-json-'));
        fs.writeFileSync(
            path.join(tmpDir, 'package.json'),
            JSON.stringify({ name: 'x', scripts: { build: 'nest build' } }),
        );

        addPluginScripts(tmpDir, [
            fakeManifest({ seed: 'tsx src/database/seeds/seed.ts' }),
            fakeManifest({ 'migration:run': 'npm run typeorm -- migration:run' }),
        ]);

        const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
        expect(pkg.scripts.build).toBe('nest build');
        expect(pkg.scripts.seed).toBe('tsx src/database/seeds/seed.ts');
        expect(pkg.scripts['migration:run']).toBe('npm run typeorm -- migration:run');
    });

    it('adds only the core scripts when no manifest declares any', () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-json-'));
        fs.writeFileSync(
            path.join(tmpDir, 'package.json'),
            JSON.stringify({ name: 'x', scripts: { build: 'nest build' } }),
        );

        addPluginScripts(tmpDir, [fakeManifest({})]);

        const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
        expect(pkg.scripts).toEqual({ build: 'nest build', typecheck: 'tsc --noEmit' });
    });

    it('adds the typecheck script every project gets, without overwriting one that already exists', () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-json-'));
        fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'x', scripts: {} }));
        addPluginScripts(tmpDir, []);
        expect(JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8')).scripts.typecheck).toBe('tsc --noEmit');

        fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'x', scripts: { typecheck: 'custom' } }));
        addPluginScripts(tmpDir, []);
        expect(JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8')).scripts.typecheck).toBe('custom');
    });
});

describe('addInstallScriptPolicy', () => {
    let dir: string;
    const write = (pkg: object) => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-policy-'));
        fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));
    };
    const read = () => JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));
    const manifest = (allowScripts?: string[]): Manifest => ({ ...fakeManifest({}), allowScripts });

    afterEach(() => { if (dir) fs.rmSync(dir, { recursive: true, force: true }); });

    it('always approves the core packages and denies the telemetry one', () => {
        write({ name: 'x', scripts: {} });
        addInstallScriptPolicy(dir, []);
        expect(read().allowScripts).toEqual({ esbuild: true, fsevents: true, '@scarf/scarf': false });
    });

    it('adds what plugins and the database driver declare', () => {
        write({ name: 'x' });
        addInstallScriptPolicy(dir, [manifest(['puppeteer']), manifest(undefined)], ['native-pkg']);
        expect(read().allowScripts).toMatchObject({ puppeteer: true, 'native-pkg': true, esbuild: true });
        expect(read().allowScripts).not.toHaveProperty('bcrypt');   // only approved when it is the chosen hasher
    });

    it('does not approve a plugin package when the plugin is not selected', () => {
        write({ name: 'x' });
        addInstallScriptPolicy(dir, []);
        expect(read().allowScripts).not.toHaveProperty('puppeteer');
    });

    it('never overrides a decision already in package.json, and keeps the other fields', () => {
        write({ name: 'x', version: '1.0.0', allowScripts: { bcrypt: false, '@scarf/scarf': true } });
        addInstallScriptPolicy(dir, []);
        expect(read().allowScripts).toMatchObject({ bcrypt: false, '@scarf/scarf': true });
        expect(read().version).toBe('1.0.0');
    });
});

