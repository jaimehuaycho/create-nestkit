import { describe, it, expect } from 'vitest';
import { applyPluginScripts, applyInstallScriptPolicy } from './package-json';
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

describe('applyPluginScripts', () => {
    it('merges every manifest script into package.json without touching existing ones', () => {
        const pkg = { name: 'x', scripts: { build: 'nest build' } as Record<string, string> };

        applyPluginScripts(pkg, [
            fakeManifest({ seed: 'tsx src/database/seeds/seed.ts' }),
            fakeManifest({ 'migration:run': 'npm run typeorm -- migration:run' }),
        ]);

        expect(pkg.scripts.build).toBe('nest build');
        expect(pkg.scripts.seed).toBe('tsx src/database/seeds/seed.ts');
        expect(pkg.scripts['migration:run']).toBe('npm run typeorm -- migration:run');
    });

    it('adds only the core scripts when no manifest declares any', () => {
        const pkg = { name: 'x', scripts: { build: 'nest build' } };

        applyPluginScripts(pkg, [fakeManifest({})]);

        expect(pkg.scripts).toEqual({ build: 'nest build', typecheck: 'tsc --noEmit' });
    });

    it('adds the typecheck script every project gets, without overwriting one that already exists', () => {
        const fresh = { name: 'x', scripts: {} as Record<string, string> };
        applyPluginScripts(fresh, []);
        expect(fresh.scripts.typecheck).toBe('tsc --noEmit');

        const custom = { name: 'x', scripts: { typecheck: 'custom' } };
        applyPluginScripts(custom, []);
        expect(custom.scripts.typecheck).toBe('custom');
    });
});

describe('applyInstallScriptPolicy', () => {
    const manifest = (allowScripts?: string[]): Manifest => ({ ...fakeManifest({}), allowScripts });
    const policyOf = (pkg: object, manifests: Manifest[] = [], extra: string[] = []) => {
        applyInstallScriptPolicy(pkg, manifests, extra);
        return (pkg as { allowScripts: Record<string, boolean> }).allowScripts;
    };

    it('always approves the core packages and denies the telemetry one', () => {
        expect(policyOf({ name: 'x', scripts: {} })).toEqual({ esbuild: true, fsevents: true, '@scarf/scarf': false });
    });

    it('adds what plugins and the database driver declare', () => {
        const policy = policyOf({ name: 'x' }, [manifest(['puppeteer']), manifest(undefined)], ['native-pkg']);
        expect(policy).toMatchObject({ puppeteer: true, 'native-pkg': true, esbuild: true });
        expect(policy).not.toHaveProperty('bcrypt');   // only approved when it is the chosen hasher
    });

    it('does not approve a plugin package when the plugin is not selected', () => {
        expect(policyOf({ name: 'x' })).not.toHaveProperty('puppeteer');
    });

    it('never overrides a decision already in package.json, and keeps the other fields', () => {
        const pkg = { name: 'x', version: '1.0.0', allowScripts: { bcrypt: false, '@scarf/scarf': true } };
        expect(policyOf(pkg)).toMatchObject({ bcrypt: false, '@scarf/scarf': true });
        expect(pkg.version).toBe('1.0.0');
    });
});
