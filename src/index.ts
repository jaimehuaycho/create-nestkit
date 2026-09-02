#!/usr/bin/env node
import * as p from '@clack/prompts';
import * as path from 'path';
import { generateProject, resolvePlugins, loadManifest } from './generator';
import { resolveNestVersion } from './nest-version';

async function main() {
    console.log();
    p.intro('create-nestkit');

    const projectName = await p.text({
        message:     'Project name',
        placeholder: 'my-api',
        validate:    (v) => !v.trim() ? 'Project name is required.' : undefined,
    });
    if (p.isCancel(projectName)) { p.cancel('Cancelled.'); process.exit(0); }

    // Resolved once, up front — used both to decide which plugins are even offered below
    // (e.g. Observability needs Nest 12+) and later to scaffold the matching version.
    const nestVersion = resolveNestVersion();

    const pluginOptions = [
        { value: 'database', label: 'Database',      hint: 'TypeORM' },
        { value: 'auth',     label: 'Auth',           hint: 'JWT + refresh token rotation  (requires database)' },
        { value: 'mailer',   label: 'Mailer',         hint: 'SMTP or HTTP API' },
        { value: 'socket',   label: 'WebSockets',     hint: 'Socket.io' },
        { value: 'pdf',      label: 'PDF generation', hint: 'Puppeteer' },
    ];

    const observeManifest = loadManifest('observe');
    if (!observeManifest.minNestMajor || nestVersion.major >= observeManifest.minNestMajor) {
        pluginOptions.push({
            value: 'observe',
            label: 'Observability',
            hint:  'Nest Observe — tracing/metrics, needs a free account at observe.nestjs.com',
        });
    }

    const selected = await p.multiselect({
        message: 'Select plugins  (space = toggle, enter = confirm)',
        options: pluginOptions,
        required: false,
    });
    if (p.isCancel(selected)) { p.cancel('Cancelled.'); process.exit(0); }

    // If database is included (directly or as a transitive dep), ask which engine.
    const resolved = resolvePlugins(selected as string[]);
    let dbDriver   = 'postgres';

    if (resolved.includes('database')) {
        const db = await p.select({
            message: 'Which database engine?',
            options: [
                { value: 'postgres', label: 'PostgreSQL',   hint: 'recommended' },
                { value: 'mysql',    label: 'MySQL' },
                { value: 'mariadb',  label: 'MariaDB' },
                { value: 'sqlite',   label: 'SQLite',        hint: 'no server needed, great for dev' },
                { value: 'mssql',    label: 'SQL Server' },
            ],
        });
        if (p.isCancel(db)) { p.cancel('Cancelled.'); process.exit(0); }
        dbDriver = db as string;
    }

    const name      = projectName as string;
    const targetDir = path.join(process.cwd(), name);

    p.log.step('Scaffolding NestJS project...');
    console.log();

    try {
        await generateProject({
            projectName: name,
            plugins:     selected as string[],
            dbDriver,
            targetDir,
            nestVersion,
        });
    } catch (err) {
        p.log.error(String(err));
        process.exit(1);
    }

    console.log();
    p.outro(
        `Done! Next steps:\n\n` +
        `  cd ${name}\n` +
        `  cp .env.example .env\n` +
        `  npm run start:dev`,
    );
}

main().catch(console.error);
