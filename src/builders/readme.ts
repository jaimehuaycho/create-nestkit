import { Manifest } from '../generator';

const DB_LABELS: Record<string, string> = {
    postgres: 'PostgreSQL',
    mysql:    'MySQL',
    mariadb:  'MariaDB',
    sqlite:   'SQLite',
    mssql:    'SQL Server',
};

// Replaces the Nest CLI's default boilerplate README (framework branding, donation links,
// generic "Nest framework TypeScript starter" description) with one describing what THIS
// project actually contains, based on the plugins picked at generation time.
export function buildReadme(
    manifests:   Manifest[],
    dbDriver:    string,
    projectName: string,
    nestMajor:   number,
): string {
    const ids     = new Set(manifests.map(m => m.id));
    const hasDb   = ids.has('database');
    const hasAuth = ids.has('auth');
    const hasMail = ids.has('mailer');
    const hasSock    = ids.has('socket');
    const hasPdf     = ids.has('pdf');
    const hasObserve = ids.has('observe');
    const anyPlugin  = hasDb || hasAuth || hasMail || hasSock || hasPdf || hasObserve;

    const l: string[] = [];

    l.push(`# ${projectName}`);
    l.push(``, `Scaffolded with [create-nestkit](https://www.npmjs.com/package/@darkj/create-nestkit).`);

    l.push(``, `## Stack`);
    l.push(`- **NestJS ${nestMajor}** + TypeScript`);
    if (hasDb)   l.push(`- **TypeORM** + ${DB_LABELS[dbDriver] ?? dbDriver}`);
    if (hasAuth) l.push(`- **JWT auth** with refresh token rotation + role-based guards`);
    if (hasMail) l.push(`- **Mailer** — SMTP or HTTP API (Resend-compatible), Port & Adapter pattern`);
    if (hasSock) l.push(`- **WebSockets** — Socket.io`);
    if (hasPdf)  l.push(`- **PDF generation** — Puppeteer`);
    if (hasObserve) l.push(`- **Observability** — Nest Observe (tracing, metrics, logs) — needs credentials from observe.nestjs.com`);
    l.push(`- **Swagger** at \`/api/docs\`, **Joi** env validation, global exception filter`);
    l.push(`- **Dockerfile** + **docker-compose.yml**`);

    l.push(``, `## Getting Started`);
    l.push(`\`\`\`bash`);
    l.push(`cp .env.example .env   # fill in your values`);
    if (hasDb)   l.push(`npm run migration:run  # apply the initial schema`);
    if (hasAuth) l.push(`npm run seed            # create the root/admin/user roles + a root user`);
    l.push(`npm run start:dev`);
    l.push(`\`\`\``);
    l.push(``, `Swagger UI: \`http://localhost:3000/api/docs\``);
    l.push(`Health check: \`http://localhost:3000/api/health\``);
    if (hasObserve) {
        l.push(``, `Sign up at [observe.nestjs.com](https://observe.nestjs.com) and set \`OBSERVE_APP_KEY\` /`);
        l.push(`\`OBSERVE_APP_SECRET\` in \`.env\` — without them the app still runs fine, telemetry is just dropped.`);
    }

    l.push(``, `## Project Structure`);
    l.push(`\`\`\``);
    l.push(`src/`);
    l.push(`├── app/        # App-level logic (${hasAuth ? 'auth, ' : ''}health) — no own DB table`);
    if (hasDb) l.push(`├── modules/    # Domain modules — one folder = one DB table`);
    if (hasMail || hasSock || hasPdf) {
        const names = [hasMail && 'mailer', hasSock && 'socket', hasPdf && 'pdf'].filter(Boolean).join(', ');
        l.push(`├── plugins/    # Port & Adapter pattern (${names})`);
    }
    if (hasDb) l.push(`├── database/   # TypeORM config, base entity, migrations, seeds`);
    l.push(`├── config/     # Global config module, env validation`);
    l.push(`└── shared/     # DTOs, filters, decorators${hasDb ? ', ORM utils' : ''}`);
    l.push(`\`\`\``);

    l.push(``, `## Scripts`);
    l.push(`| Command | Description |`);
    l.push(`|---|---|`);
    l.push(`| \`npm run start:dev\` | Development server with watch |`);
    l.push(`| \`npm run build\` | Compile TypeScript |`);
    l.push(`| \`npm run start:prod\` | Run the compiled build |`);
    if (hasDb) {
        l.push(`| \`npm run migration:generate -- src/database/migrations/<Name>\` | Generate a migration from entity changes |`);
        l.push(`| \`npm run migration:run\` | Apply pending migrations |`);
        l.push(`| \`npm run migration:revert\` | Revert the last migration |`);
        l.push(`| \`npm run seed\` | Run the seed script |`);
    }

    l.push(``, `## Docker`);
    l.push(`\`\`\`bash`);
    l.push(`docker compose up --build`);
    l.push(`\`\`\``);

    l.push(``, `## Working with Claude Code`);
    l.push(`This project ships with a \`.claude/\` folder tailored to ${anyPlugin ? 'the plugins you selected' : 'this bare scaffold'}:`);
    l.push(`- \`.claude/rules/\` — the conventions this codebase follows`);
    l.push(`- \`.claude/commands/\` — slash commands (\`/nestjs/exception\`, \`/nestjs/plugin\`${hasDb ? `, \`/nestjs/module\`, \`/db/map\`` : ''})`);
    l.push(`- \`.claude/context/\` — project journal; log decisions here as the project evolves past this starting point`);

    return l.join('\n') + '\n';
}
