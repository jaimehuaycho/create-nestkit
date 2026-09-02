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
}

export interface Manifest {
    id:       string;
    requires: string[];
    appModule: { imports: string[]; modules: string[] };
    dependencies: { prod: string[]; dev: string[] };
    scripts:  Record<string, string>;
    docker?:  { base?: 'alpine' | 'debian' };
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

export async function generateProject({ projectName, plugins, dbDriver, targetDir }: GeneratorOptions) {
    const parentDir   = path.dirname(targetDir);
    const resolvedIds = resolvePlugins(plugins);
    const manifests   = resolvedIds.map(loadManifest);
    const driver      = DB_DRIVERS[dbDriver] ?? DB_DRIVERS.postgres;

    // 1. Scaffold base project with the official NestJS CLI.
    // Never scaffold off `@latest` blindly — a new Nest major can change the scaffold shape
    // (v12 switched to ESM `"type": "module"` + pulled in TS 6's implicit `strict: true`).
    // Instead, match whatever NestJS version the user actually has installed, falling back
    // to the newest major the templates are verified against. See src/nest-version.ts.
    const nestVersion = resolveNestVersion();
    execSync(
        `npx --yes @nestjs/cli@${nestVersion.cliRange} new ${projectName} --skip-install --skip-git --package-manager npm`,
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

    // 6a. Post-process health controller: strip @Public() when auth plugin is absent
    // (no JWT guard = no need for @Public; missing import would cause TS error)
    if (!resolvedIds.includes('auth')) {
        const healthCtrl = path.join(targetDir, 'src', 'app', 'health', 'controllers', 'health.controller.ts');
        if (fs.existsSync(healthCtrl)) {
            let src = fs.readFileSync(healthCtrl, 'utf-8');
            src = src
                .replace(/^import \{ Public \}.*\n/m, '')
                .replace(/\s*@Public\(\)\s*\n/g, '\n');
            fs.writeFileSync(healthCtrl, src);
        }
    }

    // 6b. Post-process seed: strip User/hashPassword imports and seeding when users plugin is absent
    if (!resolvedIds.includes('users') && resolvedIds.includes('database')) {
        const seedFile = path.join(targetDir, 'src', 'database', 'seeds', 'seed.ts');
        if (fs.existsSync(seedFile)) {
            fs.writeFileSync(seedFile, [
                `// dotenv must load first — this script runs outside NestJS.`,
                `import 'dotenv/config';`,
                `import { AppDataSource } from '../config/data-source';`,
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
        'typeorm',           // always needed: shared/orm/ and MutationOptions use EntityManager
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

    // Copy the /db/map command only when database plugin is active
    if (resolvedIds.includes('database')) {
        const dbCommandSrc = path.join(TEMPLATES_DIR, 'core', '.claude', 'commands-db');
        if (fs.existsSync(dbCommandSrc)) {
            copyDir(dbCommandSrc, path.join(claudeDir, 'commands', 'db'));
        }
    }
}
