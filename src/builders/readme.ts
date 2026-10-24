import { Manifest } from '../generator';
import { NEST } from '../nest-version';
import { PasswordHasher } from './password-hasher';
import { firstRunSteps, renderSteps } from '../next-steps';

const DB_LABELS: Record<string, string> = {
    postgres: 'PostgreSQL',
    mysql:    'MySQL',
    mariadb:  'MariaDB',
    mssql:    'SQL Server',
};

// Replaces the Nest CLI's default boilerplate README (framework branding, donation links,
// generic "Nest framework TypeScript starter" description) with one describing what THIS
// project actually contains, based on the plugins picked at generation time.
export function buildReadme(
    manifests:   Manifest[],
    dbDriver:    string,
    projectName: string,
    hasher?:     PasswordHasher | null,
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
    l.push(`- **NestJS ${NEST.major}** + TypeScript`);
    if (hasDb)   l.push(`- **TypeORM** + ${DB_LABELS[dbDriver] ?? dbDriver}`);
    if (hasAuth) l.push(`- **JWT auth** with refresh-token families, e-mail codes, optional TOTP two-factor and per-route roles, passwords hashed with **${hasher?.label ?? 'bcrypt'}**`);
    if (hasMail) l.push(`- **Mailer** — SMTP or HTTP API (Resend-compatible), Port & Adapter pattern`);
    if (hasSock) l.push(`- **WebSockets** — Socket.io`);
    if (hasPdf)  l.push(`- **PDF generation** — Puppeteer`);
    if (hasObserve) l.push(`- **Observability** — Nest Observe (tracing, metrics, logs) — needs credentials from observe.nestjs.com`);
    l.push(`- **Swagger** at \`/api/docs\`, **Joi** env validation, global exception filter`);
    l.push(`- **Dockerfile** + **docker-compose.yml**`);

    l.push(``, `## Getting Started`);
    l.push(`\`\`\`bash`);
    l.push(...renderSteps(firstRunSteps({ hasDb, hasAuth, dbDriver })));
    l.push(`\`\`\``);
    if (hasDb) {
        l.push(``, `No migrations or seeds run automatically, and none are shipped: the schema is yours to define. Create your`);
        l.push(`entities, generate a migration from them, and run it. \`migration:generate\` compares your entities with the`);
        l.push(`live database, so the database must be running first.${hasAuth ? ' The Auth seed is optional and needs the tables to exist.' : ''}`);
    }
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
    if (hasMail || hasSock || hasPdf || hasObserve) {
        const names = [hasMail && 'mailer', hasSock && 'socket', hasPdf && 'pdf', hasObserve && 'observe'].filter(Boolean).join(', ');
        l.push(`├── plugins/    # Integrations (${names})`);
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
    l.push(`- \`.claude/CLAUDE.md\` and \`.claude/rules/\` — what Claude Code needs to know; area rules load only when you work in that area`);
    l.push(`- \`.claude/skills/\` — slash skills (\`/nest-exception\`, \`/nest-plugin\`${hasDb ? `, \`/nest-module\`, \`/db-map\`` : ''})`);
    l.push(`- \`.claude/agents/\` — subagents: \`code-reviewer\` and \`test-runner\``);
    l.push(`- \`.claude/settings.json\` — permissions and hooks (formatting on edit, protection for \`.env\`, lockfiles and applied migrations)`);
    l.push(`- \`.claude/context/\` — project journal; log decisions here as the project evolves past this starting point`);

    l.push(``, `## Notes`);
    l.push(`- \`npm audit\` may report advisories in development tooling that ships with the Nest scaffold (for example`);
    l.push(`  \`@nestjs/mau\`). Check what runs in production with \`npm audit --omit=dev\`.`);
    l.push(`- \`package.json\` has an \`allowScripts\` section listing the dependencies allowed to run install scripts`);
    l.push(`  (npm 11+). Review it with \`npm approve-scripts --allow-scripts-pending\` when you add native packages.`);

    return l.join('\n') + '\n';
}
