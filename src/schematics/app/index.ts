import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { MergeStrategy, Rule, Tree, apply, chain, externalSchematic, filter, mergeWith, move, url } from '@angular-devkit/schematics';
import { DB_DRIVERS, loadManifest, resolvePlugins } from '../../generator';
import { buildAppModule } from '../../builders/app-module';
import { APP_NAME_PATH, buildAppName } from '../../builders/app-name';
import { buildAllClaudeFiles } from '../../builders/claude-md';
import { buildDockerCompose } from '../../builders/docker-compose';
import { buildDockerfile } from '../../builders/dockerfile';
import { buildEnvExample } from '../../builders/env-example';
import { buildEnvValidation } from '../../builders/env-validation';
import { buildGitignore } from '../../builders/gitignore';
import { buildHealthController } from '../../builders/health-controller';
import { buildMainTs } from '../../builders/main-ts';
import { applyNestAssets } from '../../builders/nest-cli';
import { applyInstallScriptPolicy, applyPluginScripts } from '../../builders/package-json';
import { PASSWORD_UTIL_PATH, getPasswordHasher } from '../../builders/password-hasher';
import { buildReadme } from '../../builders/readme';
import { SEED_PATH, buildEmptySeed } from '../../builders/seed';
import { buildSettingsJson } from '../../builders/settings-json';
import { buildTsconfig } from '../../builders/tsconfig';

// dist/schematics/app (or src/schematics/app) -> the package root's templates/.
const TEMPLATES_DIR = path.join(__dirname, '..', '..', '..', 'templates');

export interface AppOptions {
    name:            string;
    type?:           'esm' | 'cjs';
    plugins?:        string[];
    dbDriver?:       string;
    passwordHasher?: string;
}

// Same rule the old copy loop had: any file or folder starting with "_" is a manifest or fragment, not project content.
const isProjectFile = (filePath: string): boolean => !filePath.split('/').some(segment => segment.startsWith('_'));

// Everything under templates/<rel>, merged over the tree at `dest` (later layers win, like the old copy order).
const fromTemplates = (rel: string, dest: string): Rule =>
    mergeWith(
        apply(url(pathToFileURL(path.join(TEMPLATES_DIR, rel)).href), [filter(isProjectFile), move(dest)]),
        MergeStrategy.Overwrite,
    );

const readTemplate = (rel: string): string => fs.readFileSync(path.join(TEMPLATES_DIR, rel), 'utf-8');

// A project is one in-memory tree: Nest's own application schematic (what `nest new` runs), then our layers on top.
// Nothing touches the disk here; the workflow that runs this decides whether and where to write.
export function main(options: AppOptions): Rule {
    const root        = options.name;
    const dbDriver    = options.dbDriver ?? 'postgres';
    const resolvedIds = resolvePlugins(options.plugins ?? []);
    const manifests   = resolvedIds.map(loadManifest);
    const driver      = DB_DRIVERS[dbDriver] ?? DB_DRIVERS.postgres;
    // Hashing exists only with the users/auth plugins, so projects without Auth carry no hashing library at all.
    const hasher      = resolvedIds.includes('users') ? getPasswordHasher(options.passwordHasher) : null;

    const at   = (rel: string) => `${root}/${rel}`;
    const text = (tree: Tree, rel: string) => tree.read(at(rel))!.toString();
    const put  = (tree: Tree, rel: string, content: string) =>
        tree.exists(at(rel)) ? tree.overwrite(at(rel), content) : tree.create(at(rel), content);
    const editJson = (tree: Tree, rel: string, edit: (value: any) => boolean | void, trailingNewline = false) => {
        const value = JSON.parse(text(tree, rel));
        if (edit(value) === false) return;
        tree.overwrite(at(rel), JSON.stringify(value, null, 2) + (trailingNewline ? '\n' : ''));
    };

    return chain([
        // 1. Nest's own project, with the options the CLI used to pass.
        externalSchematic('@nestjs/schematics', 'application', {
            name: root, type: options.type ?? 'esm', language: 'ts', packageManager: 'npm', strict: true, format: false,
        }),

        // 2. Our tsconfig, keeping the test runner `types` Nest chose (vitest/globals for ESM, jest for CommonJS).
        (tree: Tree) => put(tree, 'tsconfig.json', buildTsconfig(readTemplate('base/tsconfig.json'), text(tree, 'tsconfig.json'))),

        // 3. Remove the defaults we replace.
        (tree: Tree) => {
            for (const rel of ['src/app.module.ts', 'src/app.controller.ts', 'src/app.controller.spec.ts', 'src/app.service.ts', 'src/main.ts']) {
                if (tree.exists(at(rel))) tree.delete(at(rel));
            }
            tree.getDir(at('test')).visit(file => tree.delete(file));
        },

        // 4-5. Core sources, then each plugin's (a plugin may overwrite a core file).
        fromTemplates('core/src', at('src')),
        ...resolvedIds
            .filter(id => fs.existsSync(path.join(TEMPLATES_DIR, 'plugins', id, 'src')))
            .map(id => fromTemplates(`plugins/${id}/src`, at('src'))),

        // 6. Dynamic files, from the pure builders.
        (tree: Tree) => {
            if (hasher) put(tree, PASSWORD_UTIL_PATH, hasher.source);

            put(tree, 'src/main.ts', buildMainTs(manifests, dbDriver));
            put(tree, APP_NAME_PATH, buildAppName(root));
            put(tree, 'src/app/health/controllers/health.controller.ts', buildHealthController(manifests));
            // Replaces Nest's boilerplate README (framework branding) with one describing what this project contains.
            put(tree, 'README.md', buildReadme(manifests, dbDriver, root, hasher));

            // Seeding needs Users: with Database alone the seed script carries no User import.
            if (!resolvedIds.includes('users') && resolvedIds.includes('database') && tree.exists(at(SEED_PATH))) {
                tree.overwrite(at(SEED_PATH), buildEmptySeed());
            }

            put(tree, 'src/app.module.ts', buildAppModule(path.join(TEMPLATES_DIR, 'core', 'src', 'app.module.ts'), manifests));
            put(tree, 'src/config/env.validation.ts', buildEnvValidation(
                path.join(TEMPLATES_DIR, 'core', 'src', 'config', 'env.validation.ts'), resolvedIds, TEMPLATES_DIR,
            ));
        },

        // 7. package.json scripts and install-script policy, nest-cli assets.
        (tree: Tree) => {
            editJson(tree, 'package.json', pkg => {
                applyPluginScripts(pkg, manifests);
                applyInstallScriptPolicy(pkg, manifests, hasher?.allowScripts ?? []);
            });
            editJson(tree, 'nest-cli.json', cli => applyNestAssets(cli, manifests), true);
        },

        // 8. Docker and env files.
        (tree: Tree) => {
            put(tree, 'Dockerfile', buildDockerfile(manifests));
            put(tree, 'docker-compose.yml', buildDockerCompose(resolvedIds, driver));
            put(tree, '.env.example', buildEnvExample(resolvedIds, dbDriver, TEMPLATES_DIR));
        },

        // 9. The project's .claude/ (docs and settings built per selection, then the static tooling) and the .gitignore.
        (tree: Tree) => {
            for (const [rel, content] of buildAllClaudeFiles(manifests, dbDriver, root, hasher?.id)) put(tree, rel, content);
            put(tree, '.claude/settings.json', buildSettingsJson(manifests));
        },
        ...['skills', 'agents', 'hooks'].map(dir => fromTemplates(`core/.claude/${dir}`, at(`.claude/${dir}`))),
        // /nest-module and /db-map scaffold TypeORM entities: meaningless without a database.
        ...(manifests.some(m => m.id === 'database') ? [fromTemplates('core/.claude/skills-db', at('.claude/skills'))] : []),
        // `nest new --skip-git` writes no .gitignore, so this builds the whole file.
        (tree: Tree) => put(tree, '.gitignore', buildGitignore(tree.exists(at('.gitignore')) ? text(tree, '.gitignore') : '')),
    ]);
}
