import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import { addPluginScripts } from './package-json';
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

    it('is a no-op on the scripts section when no manifest declares any', () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-json-'));
        fs.writeFileSync(
            path.join(tmpDir, 'package.json'),
            JSON.stringify({ name: 'x', scripts: { build: 'nest build' } }),
        );

        addPluginScripts(tmpDir, [fakeManifest({})]);

        const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
        expect(pkg.scripts).toEqual({ build: 'nest build' });
    });
});
