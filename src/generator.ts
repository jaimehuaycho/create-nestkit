import * as fs            from 'fs';
import * as path          from 'path';
import { execSync }       from 'child_process';
import { NodeWorkflow }   from '@angular-devkit/schematics/tools';
import { getPasswordHasher, PasswordHasherId } from './builders/password-hasher';
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

const PACKAGE_ROOT   = path.join(__dirname, '..');
const TEMPLATES_DIR  = path.join(PACKAGE_ROOT, 'templates');
const COLLECTION     = path.join(__dirname, 'schematics', 'collection.json');

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
    // Module system of the generated project: Nest's ESM scaffold (vitest) or its CommonJS one (jest). Defaults to ESM.
    moduleSystem?: 'esm' | 'cjs';
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

// Builds the project on disk: Nest's own application schematic plus our layers, run as ONE in-memory tree and written at the end
// (src/schematics/app). Nothing is written if any step fails. It is what `nest new` does through the schematics CLI, without the
// subprocess, the registry lookup or a prompt we do not control.
export async function scaffoldProject(parentDir: string, options: Record<string, unknown>, dryRun = false): Promise<void> {
    const workflow = new NodeWorkflow(parentDir, { dryRun, resolvePaths: [PACKAGE_ROOT], schemaValidation: true });
    await workflow.execute({ collection: COLLECTION, schematic: 'app', options }).toPromise();
}

export async function generateProject({ projectName, plugins, dbDriver, targetDir, passwordHasher, moduleSystem }: GeneratorOptions) {
    // First thing, before any filesystem or shell work: the target must not clobber something that already exists.
    const invalid = validateProjectName(projectName) ?? validateTargetDir(targetDir);
    if (invalid) throw new Error(invalid);

    const resolvedIds = resolvePlugins(plugins);
    const manifests   = resolvedIds.map(loadManifest);
    const driver      = DB_DRIVERS[dbDriver] ?? DB_DRIVERS.postgres;
    // Hashing exists only with the users/auth plugins, so projects without Auth install no hashing library at all.
    const hasher      = resolvedIds.includes('users') ? getPasswordHasher(passwordHasher) : null;

    await scaffoldProject(path.dirname(targetDir), { name: projectName, type: moduleSystem ?? 'esm', plugins, dbDriver, passwordHasher });

    // Install dependencies. Every name goes through pinDep: no bare names, so nothing resolves to a surprise major.
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
}
