import * as fs            from 'fs';
import * as path          from 'path';
import { execSync }       from 'child_process';
import { buildAppModule }     from './builders/app-module';
import { buildEnvValidation } from './builders/env-validation';
import { addPluginScripts, addInstallScriptPolicy } from './builders/package-json';
import { addNestAssets } from './builders/nest-cli';
import { getPasswordHasher, writePasswordUtil, PasswordHasherId } from './builders/password-hasher';
import { buildDockerfile }    from './builders/dockerfile';
import { buildDockerCompose } from './builders/docker-compose';
import { buildEnvExample }    from './builders/env-example';
import { buildMainTs }        from './builders/main-ts';
import { buildHealthController } from './builders/health-controller';
import { buildReadme }        from './builders/readme';
import { buildAllClaudeFiles } from './builders/claude-md';
import { buildSettingsJson } from './builders/settings-json';
import { buildGitignore } from './builders/gitignore';
import { buildTsconfig } from './builders/tsconfig';
import { resolveNestCliVersion } from './nest-cli-version';
import { NEST } from './nest-version';
import { DEPENDENCY_RANGES } from './dependencies';
import { validateProjectName, validateTargetDir } from './validate';

// Appends the range this package is pinned to: the target Nest major for the coupled @nestjs/* packages, or the verified
// major from DEPENDENCY_RANGES for everything else. Never installs a bare name, so a new major of any dependency cannot
// reach new projects by surprise (see src/dependencies.ts).
export function pinDep(name: string): string {
    const range = NEST.packages[name] ?? DEPENDENCY_RANGES[name];
    if (!range) throw new Error(`No version range for "${name}". Add it to DEPENDENCY_RANGES in src/dependencies.ts.`);
    return `${name}@${range}`;
}

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

// ---------------------------------------------------------------------------
// DB driver map — package(s) to install + docker-compose service per engine
// ---------------------------------------------------------------------------
interface DbDriver {
    prod:          string[];
    dev:           string[];
    composeService?: string;
    composeVolume?:  string;
    appDependsOn?:   string;
    // Port the engine listens on INSIDE its container (the host side of `ports:` can differ). The app container reaches it as db:<port>.
    containerPort?:  number;
}

// Installed in every generated project, on top of what `nest new` provides. (swagger-ui-express is NOT here:
// @nestjs/swagger 12 bundles swagger-ui-dist and its docs list no other install for Express.)
export const CORE_PROD_DEPENDENCIES = [
    '@nestjs/config',
    '@nestjs/swagger',
    '@nestjs/terminus',
    'joi',
    'dotenv',
    'class-validator',
    'class-transformer',
];

export const DB_DRIVERS: Record<string, DbDriver> = {
    postgres: {
        prod: ['pg'],
        dev:  [],
        appDependsOn:   'db:\n        condition: service_healthy',
        composeService: [
            '  db:',
            '    image: postgres:16-alpine',
            '    restart: unless-stopped',
            '    environment:',
            '      POSTGRES_DB:       ${DB_NAME}',
            '      POSTGRES_USER:     ${DB_USER}',
            '      POSTGRES_PASSWORD: ${DB_PASSWORD}',
            '    ports:',
            '      - "${DB_PORT:-5432}:5432"',
            '    volumes:',
            '      - db_data:/var/lib/postgresql/data',
            '    healthcheck:',
            '      test: ["CMD-SHELL", "pg_isready -U $${DB_USER} -d $${DB_NAME}"]',
            '      interval: 10s',
            '      timeout: 5s',
            '      retries: 5',
        ].join('\n'),
        containerPort: 5432,
        composeVolume: '  db_data:',
    },
    mysql: {
        prod: ['mysql2'],
        dev:  [],
        appDependsOn:   'db:\n        condition: service_healthy',
        composeService: [
            '  db:',
            '    image: mysql:8-oracle',
            '    restart: unless-stopped',
            '    environment:',
            '      MYSQL_DATABASE:      ${DB_NAME}',
            '      MYSQL_USER:          ${DB_USER}',
            '      MYSQL_PASSWORD:      ${DB_PASSWORD}',
            '      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}',
            '    ports:',
            '      - "${DB_PORT:-3306}:3306"',
            '    volumes:',
            '      - db_data:/var/lib/mysql',
            '    healthcheck:',
            '      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]',
            '      interval: 10s',
            '      timeout: 5s',
            '      retries: 5',
        ].join('\n'),
        containerPort: 3306,
        composeVolume: '  db_data:',
    },
    mariadb: {
        prod: ['mysql2'],
        dev:  [],
        appDependsOn:   'db:\n        condition: service_healthy',
        composeService: [
            '  db:',
            '    image: mariadb:11',
            '    restart: unless-stopped',
            '    environment:',
            '      MARIADB_DATABASE:      ${DB_NAME}',
            '      MARIADB_USER:          ${DB_USER}',
            '      MARIADB_PASSWORD:      ${DB_PASSWORD}',
            '      MARIADB_ROOT_PASSWORD: ${DB_PASSWORD}',
            '    ports:',
            '      - "${DB_PORT:-3306}:3306"',
            '    volumes:',
            '      - db_data:/var/lib/mysql',
            '    healthcheck:',
            '      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]',
            '      interval: 10s',
            '      timeout: 5s',
            '      retries: 5',
        ].join('\n'),
        containerPort: 3306,
        composeVolume: '  db_data:',
    },
    mssql: {
        prod: ['mssql'],
        dev:  [],
        // SQL Server is complex to configure via compose — left to the user
    },
};

// The driver belongs to the Database plugin. Without it nothing talks to a database, and the driver is dead weight
// (a project with no database used to install `pg`, because the default engine is postgres whatever was selected).
export function driverDependencies(resolvedIds: string[], driver: Pick<DbDriver, 'prod' | 'dev'>): { prod: string[]; dev: string[] } {
    return resolvedIds.includes('database') ? { prod: driver.prod, dev: driver.dev } : { prod: [], dev: [] };
}

// ---------------------------------------------------------------------------

export interface GeneratorOptions {
    projectName: string;
    plugins:     string[];
    dbDriver:    string;
    targetDir:   string;
    // Password hashing algorithm, only used when Auth is selected. Defaults to bcrypt.
    passwordHasher?: PasswordHasherId;
}

export interface Manifest {
    id:       string;
    requires: string[];
    appModule: { imports: string[]; modules: string[] };
    dependencies: { prod: string[]; dev: string[] };
    scripts:  Record<string, string>;
    docker?:  { base?: 'alpine' | 'debian' };
    // Packages (from this plugin's dependencies, direct or transitive) whose install scripts must run.
    // Written into the generated package.json `allowScripts` so npm's install-script policy (advisory
    // today, blocking in a future release) never silently skips them, e.g. puppeteer downloading Chrome.
    allowScripts?: string[];
    // Non-TypeScript files this plugin needs in dist/ (globs relative to src/), written into nest-cli.json `assets`.
    nestAssets?: string[];
}

export function loadManifest(pluginId: string): Manifest {
    const p = path.join(TEMPLATES_DIR, 'plugins', pluginId, '_manifest.json');
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

// Resolves transitive plugin dependencies in dependency order.
export function resolvePlugins(selected: string[]): string[] {
    const resolved: string[] = [];
    const seen = new Set<string>();

    function resolve(id: string) {
        if (seen.has(id)) return;
        seen.add(id);
        loadManifest(id).requires.forEach(resolve);
        resolved.push(id);
    }

    selected.forEach(resolve);
    return resolved;
}

// Copies a directory recursively, substituting {{VAR}} placeholders.
// Skips files/dirs starting with '_' (manifests, fragments).
function copyDir(src: string, dest: string, vars: Record<string, string> = {}) {
    fs.mkdirSync(dest, { recursive: true });

    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        if (entry.name.startsWith('_')) continue;

        const srcPath  = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath, vars);
        } else {
            let content = fs.readFileSync(srcPath, 'utf-8');
            for (const [key, val] of Object.entries(vars)) {
                content = content.replaceAll(`{{${key}}}`, val);
            }
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.writeFileSync(destPath, content);
        }
    }
}

export async function generateProject({ projectName, plugins, dbDriver, targetDir, passwordHasher }: GeneratorOptions) {
    // First thing, before any filesystem or shell work: projectName is interpolated into the
    // `nest new` command below, and the target must not clobber something that already exists.
    const invalid = validateProjectName(projectName) ?? validateTargetDir(targetDir);
    if (invalid) throw new Error(invalid);

    const parentDir   = path.dirname(targetDir);
    const resolvedIds = resolvePlugins(plugins);
    const manifests   = resolvedIds.map(loadManifest);
    const driver      = DB_DRIVERS[dbDriver] ?? DB_DRIVERS.postgres;
    // Hashing exists only with the users/auth plugins, so projects without Auth install no hashing library at all.
    const hasher        = resolvedIds.includes('users') ? getPasswordHasher(passwordHasher) : null;

    // 1. Scaffold base project with the official NestJS CLI.
    // Some majors add scaffold prompts create-nestkit doesn't control via a flag (e.g. v12's
    // ESM/CommonJS choice). Tried suppressing it by closing/piping stdin — doesn't work: the
    // underlying prompt reads straight from /dev/tty, bypassing whatever we hand it as stdio,
    // and closing stdin just makes it abort with "User force closed the prompt" instead of
    // silently picking the highlighted default. So it stays interactive with `stdio: 'inherit'`
    // — harmless either way, since the templates compile under both ESM and CommonJS (verified).
    // The exact latest version in the range, not the range: npx caches a range under its text and would keep reusing an old 12.x (nest-cli-version.ts).
    execSync(
        `npx --yes @nestjs/cli@${resolveNestCliVersion()} new ${projectName} --skip-install --skip-git --package-manager npm ${NEST.newFlags.join(' ')}`,
        { cwd: parentDir, stdio: 'inherit' },
    );

    // 2. Override nest-generated tsconfig with ours (removes deprecated baseUrl, adds paths), keeping the test runner `types` Nest chose
    //    (vitest/globals for ESM, jest for CommonJS), which would otherwise be lost.
    const tsconfigPath = path.join(targetDir, 'tsconfig.json');
    fs.writeFileSync(
        tsconfigPath,
        buildTsconfig(fs.readFileSync(path.join(TEMPLATES_DIR, 'base', 'tsconfig.json'), 'utf-8'), fs.readFileSync(tsconfigPath, 'utf-8')),
    );

    // 3. Remove default files that we replace with our own
    for (const rel of ['src/app.module.ts', 'src/app.controller.ts', 'src/app.controller.spec.ts', 'src/app.service.ts', 'src/main.ts', 'test']) {
        const full = path.join(targetDir, rel);
        if (fs.existsSync(full)) fs.rmSync(full, { recursive: true, force: true });
    }

    // 4. Copy core source files
    copyDir(path.join(TEMPLATES_DIR, 'core', 'src'), path.join(targetDir, 'src'));

    // 5. Copy selected plugin source files
    for (const id of resolvedIds) {
        const pluginSrc = path.join(TEMPLATES_DIR, 'plugins', id, 'src');
        if (fs.existsSync(pluginSrc)) {
            copyDir(pluginSrc, path.join(targetDir, 'src'));
        }
    }

    // The password hashing module for the chosen algorithm (only with Auth). Same API whichever was chosen.
    if (hasher) writePasswordUtil(targetDir, hasher);

    // 6. Generate dynamic files
    fs.writeFileSync(
        path.join(targetDir, 'src', 'main.ts'),
        buildMainTs(manifests, dbDriver, projectName),
    );

    // 6a. Health controller: DB ping check + @Public() only wired in when
    // the plugins backing them (database, auth) are actually active.
    const healthCtrlPath = path.join(targetDir, 'src', 'app', 'health', 'controllers', 'health.controller.ts');
    fs.mkdirSync(path.dirname(healthCtrlPath), { recursive: true });
    fs.writeFileSync(healthCtrlPath, buildHealthController(manifests));

    // Replace the Nest CLI's boilerplate README (framework branding, generic description)
    // with one describing what this project actually contains.
    fs.writeFileSync(
        path.join(targetDir, 'README.md'),
        buildReadme(manifests, dbDriver, projectName, hasher),
    );

    // 6b. Post-process seed: strip User/hashPassword imports and seeding when users plugin is absent
    if (!resolvedIds.includes('users') && resolvedIds.includes('database')) {
        const seedFile = path.join(targetDir, 'src', 'database', 'seeds', 'seed.ts');
        if (fs.existsSync(seedFile)) {
            fs.writeFileSync(seedFile, [
                `// dotenv must load first — this script runs outside NestJS.`,
                `import 'dotenv/config';`,
                `import { AppDataSource } from '../config/data-source.js';`,
                ``,
                `async function seed(): Promise<void> {`,
                `    console.log('\\n▶  Running seed...\\n');`,
                `    await AppDataSource.initialize();`,
                `    console.log('  ✔  Database connection established');`,
                `    // Add seeders here.`,
                `    console.log('\\n✔  Seed completed.\\n');`,
                `    await AppDataSource.destroy();`,
                `}`,
                ``,
                `seed();`,
                ``,
            ].join('\n'));
        }
    }

    fs.writeFileSync(
        path.join(targetDir, 'src', 'app.module.ts'),
        buildAppModule(path.join(TEMPLATES_DIR, 'core', 'src', 'app.module.ts'), manifests),
    );

    fs.writeFileSync(
        path.join(targetDir, 'src', 'config', 'env.validation.ts'),
        buildEnvValidation(
            path.join(TEMPLATES_DIR, 'core', 'src', 'config', 'env.validation.ts'),
            resolvedIds,
            TEMPLATES_DIR,
        ),
    );

    addPluginScripts(targetDir, manifests);
    // Before `npm install`, so the very first install already follows the policy.
    addInstallScriptPolicy(targetDir, manifests, hasher?.allowScripts ?? []);
    addNestAssets(targetDir, manifests);

    // 7. Install dependencies. Every name goes through pinDep: no bare names, so nothing resolves to a surprise major.
    const driverDeps   = driverDependencies(resolvedIds, driver);
    const coreProdDeps = CORE_PROD_DEPENDENCIES.map(d => pinDep(d));
    const pluginProd   = [...manifests.flatMap(m => m.dependencies.prod), ...(hasher?.dependencies.prod ?? [])].map(d => pinDep(d));
    const pluginDev    = [...manifests.flatMap(m => m.dependencies.dev), ...(hasher?.dependencies.dev ?? [])].map(d => pinDep(d));

    execSync(
        `npm install ${[...coreProdDeps, ...driverDeps.prod.map(d => pinDep(d)), ...pluginProd].join(' ')}`,
        { cwd: targetDir, stdio: 'inherit' },
    );

    const allDev = [...driverDeps.dev.map(d => pinDep(d)), ...pluginDev];
    if (allDev.length > 0) {
        execSync(
            `npm install --save-dev ${allDev.join(' ')}`,
            { cwd: targetDir, stdio: 'inherit' },
        );
    }

    // 8. Generate Docker + env files
    fs.writeFileSync(
        path.join(targetDir, 'Dockerfile'),
        buildDockerfile(manifests),
    );

    fs.writeFileSync(
        path.join(targetDir, 'docker-compose.yml'),
        buildDockerCompose(resolvedIds, driver),
    );

    fs.writeFileSync(
        path.join(targetDir, '.env.example'),
        buildEnvExample(resolvedIds, dbDriver, TEMPLATES_DIR),
    );

    // 9. Generate the project's .claude/ (rules, settings, tooling) — tailored to selected plugins
    writeClaudeTooling(targetDir, manifests, dbDriver, projectName, hasher?.id);
}

// Writes everything Claude Code reads from a generated project: the docs built per plugin selection
// (CLAUDE.md, rules, journal), the enforced settings (permissions + hooks), the static tooling from the
// core template (skills, subagents, hook scripts) and the .gitignore entries for personal state.
// Exported so the whole output can be tested without running `nest new` and `npm install`.
export function writeClaudeTooling(targetDir: string, manifests: Manifest[], dbDriver: string, projectName: string, passwordHasher?: PasswordHasherId): void {
    const claudeDir = path.join(targetDir, '.claude');

    const claudeFiles = buildAllClaudeFiles(manifests, dbDriver, projectName, passwordHasher);
    for (const [relPath, content] of claudeFiles) {
        const fullPath = path.join(targetDir, relPath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content);
    }

    // Enforced configuration: permissions and hooks (settings.json), plus the static tooling from the
    // core template: skills, subagents and hook scripts. Underscore-prefixed entries are skipped by copyDir.
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), buildSettingsJson(manifests));

    const coreClaudeDir = path.join(TEMPLATES_DIR, 'core', '.claude');
    for (const dir of ['skills', 'agents', 'hooks']) {
        copyDir(path.join(coreClaudeDir, dir), path.join(claudeDir, dir));
    }

    // /nest-module and /db-map scaffold TypeORM entities + DtoRepository: meaningless without a database.
    if (manifests.some(m => m.id === 'database')) {
        copyDir(path.join(coreClaudeDir, 'skills-db'), path.join(claudeDir, 'skills'));
    }

    // `nest new --skip-git` writes no .gitignore, so this builds the whole file (and keeps secrets and personal Claude Code state out of git).
    const gitignorePath = path.join(targetDir, '.gitignore');
    const gitignore     = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf-8') : '';
    fs.writeFileSync(gitignorePath, buildGitignore(gitignore));
}
