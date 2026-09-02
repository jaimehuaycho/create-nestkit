import * as fs            from 'fs';
import * as path          from 'path';
import { execSync }       from 'child_process';
import { buildAppModule }     from './builders/app-module';
import { buildEnvValidation } from './builders/env-validation';
import { addPluginScripts }   from './builders/package-json';
import { buildDockerfile }    from './builders/dockerfile';
import { buildDockerCompose } from './builders/docker-compose';
import { buildEnvExample }    from './builders/env-example';
import { buildMainTs }        from './builders/main-ts';
import { buildHealthController } from './builders/health-controller';
import { buildReadme }        from './builders/readme';
import { buildAllClaudeFiles } from './builders/claude-md';
import { resolveNestVersion, NestVersionProfile } from './nest-version';

// Appends the version pinned for this Nest major if the package is one of the
// tightly-coupled @nestjs/* siblings; otherwise installs whatever npm resolves as latest.
export function pinDep(name: string, nestVersion: NestVersionProfile): string {
    const range = nestVersion.packages[name];
    return range ? `${name}@${range}` : name;
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
}

const DB_DRIVERS: Record<string, DbDriver> = {
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
        composeVolume: '  db_data:',
    },
    sqlite: {
        prod: ['better-sqlite3'],
        dev:  ['@types/better-sqlite3'],
        // SQLite needs no compose service — the DB is a local file
    },
    mssql: {
        prod: ['mssql'],
        dev:  [],
        // SQL Server is complex to configure via compose — left to the user
    },
};

// ---------------------------------------------------------------------------

export interface GeneratorOptions {
    projectName: string;
    plugins:     string[];
    dbDriver:    string;
    targetDir:   string;
    // Optional: pass the already-resolved profile when the caller needed it earlier anyway
    // (e.g. index.ts uses it to decide which plugins to even offer). Falls back to resolving
    // it here so existing callers/tests that don't pass it keep working unchanged.
    nestVersion?: NestVersionProfile;
}

export interface Manifest {
    id:       string;
    requires: string[];
    appModule: { imports: string[]; modules: string[] };
    dependencies: { prod: string[]; dev: string[] };
    scripts:  Record<string, string>;
    docker?:  { base?: 'alpine' | 'debian' };
    // Lowest NestJS major this plugin works with (e.g. @nestjs/observe only exists on 12+).
    // Enforced both here and by index.ts, which shouldn't offer the option in the first place.
    minNestMajor?: number;
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

export async function generateProject({ projectName, plugins, dbDriver, targetDir, nestVersion: passedNestVersion }: GeneratorOptions) {
    const parentDir   = path.dirname(targetDir);
    const resolvedIds = resolvePlugins(plugins);
    const manifests   = resolvedIds.map(loadManifest);
    const driver      = DB_DRIVERS[dbDriver] ?? DB_DRIVERS.postgres;

    // Never scaffold off `@latest` blindly — a new Nest major can change the scaffold shape
    // (v12 switched to ESM `"type": "module"` + pulled in TS 6's implicit `strict: true`).
    // Instead, match whatever NestJS version the user actually has installed, falling back
    // to the newest major the templates are verified against. See src/nest-version.ts.
    const nestVersion = passedNestVersion ?? resolveNestVersion();

    // Defends the invariant index.ts's prompt already enforces (it shouldn't offer a plugin
    // whose minNestMajor exceeds the resolved version) — catches programmatic/API misuse too.
    for (const m of manifests) {
        if (m.minNestMajor && nestVersion.major < m.minNestMajor) {
            throw new Error(
                `Plugin "${m.id}" requires NestJS ${m.minNestMajor}+, but v${nestVersion.major} was resolved.`,
            );
        }
    }

    // 1. Scaffold base project with the official NestJS CLI.
    const newFlags = nestVersion.newFlags ?? [];
    // Some majors add scaffold prompts create-nestkit doesn't control via a flag (e.g. v12's
    // ESM/CommonJS choice). Tried suppressing it by closing/piping stdin — doesn't work: the
    // underlying prompt reads straight from /dev/tty, bypassing whatever we hand it as stdio,
    // and closing stdin just makes it abort with "User force closed the prompt" instead of
    // silently picking the highlighted default. So it stays interactive with `stdio: 'inherit'`
    // — harmless either way, since the templates compile under both ESM and CommonJS (verified).
    execSync(
        `npx --yes @nestjs/cli@${nestVersion.cliRange} new ${projectName} --skip-install --skip-git --package-manager npm ${newFlags.join(' ')}`,
        { cwd: parentDir, stdio: 'inherit' },
    );

    // 2. Override nest-generated tsconfig with ours (removes deprecated baseUrl, adds paths)
    fs.copyFileSync(
        path.join(TEMPLATES_DIR, 'base', 'tsconfig.json'),
        path.join(targetDir, 'tsconfig.json'),
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
        buildReadme(manifests, dbDriver, projectName, nestVersion.major),
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

    // 7. Install dependencies
    // Bare names resolve to npm's `latest`; anything listed in nestVersion.packages
    // gets pinned to the range that's actually compatible with the scaffolded major.
    const coreProdDeps = [
        '@nestjs/config',
        '@nestjs/swagger',
        '@nestjs/terminus',
        'swagger-ui-express',
        'joi',
        'dotenv',
        'bcrypt',
        'class-validator',
        'class-transformer',
    ].map(d => pinDep(d, nestVersion));
    const coreDevDeps  = ['@types/bcrypt'];
    const pluginProd   = manifests.flatMap(m => m.dependencies.prod).map(d => pinDep(d, nestVersion));
    const pluginDev    = manifests.flatMap(m => m.dependencies.dev);

    execSync(
        `npm install ${[...coreProdDeps, ...driver.prod, ...pluginProd].join(' ')}`,
        { cwd: targetDir, stdio: 'inherit' },
    );

    const allDev = [...coreDevDeps, ...driver.dev, ...pluginDev];
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

    // 9. Generate .claude/ and src/*/CLAUDE.md — tailored to selected plugins
    const claudeFiles = buildAllClaudeFiles(manifests, dbDriver, projectName);
    for (const [relPath, content] of claudeFiles) {
        const fullPath = path.join(targetDir, relPath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content);
    }

    // Copy slash commands from the core template (always)
    const claudeDir       = path.join(targetDir, '.claude');
    const coreCommandsDir = path.join(TEMPLATES_DIR, 'core', '.claude', 'commands');
    if (fs.existsSync(coreCommandsDir)) {
        copyDir(coreCommandsDir, path.join(claudeDir, 'commands'));
    }

    // Copy DB-dependent commands (/nestjs/module, /db/map) only when database plugin is active —
    // /nestjs/module scaffolds TypeORM entities + DtoRepository, meaningless without a DB.
    if (resolvedIds.includes('database')) {
        const dbCommandSrc = path.join(TEMPLATES_DIR, 'core', '.claude', 'commands-db');
        if (fs.existsSync(dbCommandSrc)) {
            copyDir(dbCommandSrc, path.join(claudeDir, 'commands'));
        }
    }
}
