import { createRequire } from 'module';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { SchematicTestRunner, UnitTestTree } from '@angular-devkit/schematics/testing';
import { loadManifest, resolvePlugins } from '../../generator';

createRequire(__filename)('ts-node/register/transpile-only');

const runner = new SchematicTestRunner('create-nestkit', path.join(__dirname, '..', 'collection.json'));

const PLUGINS = ['database', 'auth', 'mailer', 'socket', 'pdf', 'observe'];
// Where each plugin's module and files live, to prove nothing of an unselected plugin leaks into a project.
const FOOTPRINT: Record<string, { marker: string; dir: string }> = {
    auth:     { marker: 'AuthModule',     dir: 'src/app/auth/' },
    database: { marker: 'DatabaseModule', dir: 'src/database/' },
    mailer:   { marker: 'MailerModule',   dir: 'src/plugins/mailer/' },
    socket:   { marker: 'SocketModule',   dir: 'src/plugins/socket/' },
    pdf:      { marker: 'PdfModule',      dir: 'src/plugins/pdf/' },
    observe:  { marker: 'ObserveModule',  dir: 'src/plugins/observe/' },
};

const subsets = Array.from({ length: 1 << PLUGINS.length }, (_, mask) => PLUGINS.filter((_, i) => mask & (1 << i)));

// Relative imports inside src/ must point at a file that exists in the project: catches a core file importing something only
// one plugin ships. Imports end in .js (ESM style) and resolve to the .ts source.
function brokenImports(tree: UnitTestTree): string[] {
    const broken: string[] = [];
    const sources = tree.files.filter(f => /\/src\/.*\.ts$/.test(f) && !f.endsWith('.d.ts'));
    const known   = new Set(tree.files);

    for (const file of sources) {
        for (const match of tree.readContent(file).matchAll(/^\s*(?:import|export)\b[^;'"]*?from\s+['"](\.{1,2}\/[^'"]+)['"]/gm)) {
            const target   = path.posix.join(path.posix.dirname(file), match[1]).replace(/\.js$/, '');
            const resolved = [`${target}.ts`, `${target}/index.ts`, target];
            if (!resolved.some(r => known.has(r))) broken.push(`${file} -> ${match[1]}`);
        }
    }
    return broken;
}

describe('every plugin selection, both module systems, in memory', () => {
    // The 64 plugin sets x ESM/CJS x two engines (sets without a database get one): ~250 projects in a few seconds.
    const cases = (['esm', 'cjs'] as const).flatMap(type =>
        subsets.flatMap(plugins => (plugins.length ? ['postgres', 'mysql'] : ['postgres']).map(dbDriver => ({ type, plugins, dbDriver }))),
    );

    it(`builds ${cases.length} consistent projects`, async () => {
        const problems: string[] = [];

        for (const { type, plugins, dbDriver } of cases) {
            const label = `${type} [${plugins}] ${dbDriver}`;
            const check = (ok: boolean, what: string) => { if (!ok) problems.push(`${label}: ${what}`); };

            const ids       = resolvePlugins(plugins);      // auth pulls in users and database
            const manifests = ids.map(loadManifest);
            const tree      = await runner.runSchematic('app', { name: 'x', type, plugins, dbDriver });
            const read      = (rel: string) => tree.readContent(`/x/${rel}`);

            for (const json of ['package.json', 'nest-cli.json', 'tsconfig.json']) {
                try { JSON.parse(read(json)); } catch { check(false, `${json} is not valid JSON`); }
            }

            const appModule = read('src/app.module.ts');
            for (const m of manifests) {
                for (const symbol of m.appModule.modules) check(appModule.includes(symbol), `${m.id}: "${symbol}" not registered in app.module.ts`);
            }
            for (const [id, { marker, dir }] of Object.entries(FOOTPRINT)) {
                if (ids.includes(id)) continue;
                check(!appModule.includes(marker), `${marker} in app.module.ts without ${id}`);
                check(!tree.files.some(f => f.includes(`/${dir}`)), `files of ${dir} without ${id}`);
            }

            check(tree.exists(type === 'esm' ? '/x/vitest.config.ts' : '/x/jest.config.ts'), `no test runner config for ${type}`);
            check((JSON.parse(read('tsconfig.json')).compilerOptions.types ?? []).length > 0, 'tsconfig lost the test runner types');
            check(!!JSON.parse(read('package.json')).allowScripts, 'allowScripts missing');
            check(/^\.env$/m.test(read('.gitignore')), '.gitignore does not ignore .env');
            check(ids.includes('database') || !/DB_HOST: db/.test(read('docker-compose.yml')), 'compose sets DB_HOST without a database');
            check(!tree.files.some(f => /\{\{[A-Z_]+\}\}/.test(tree.readContent(f))), 'an unreplaced {{PLACEHOLDER}} is left in the output');

            for (const broken of brokenImports(tree)) check(false, `broken import ${broken}`);
        }

        expect(problems).toEqual([]);
    }, 120_000);
});
