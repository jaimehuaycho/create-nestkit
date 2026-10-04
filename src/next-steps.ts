// The first-run sequence of a generated project, rendered into its README. The CLI's closing message stays
// minimal on purpose (cd, cp .env.example .env, start:dev): the detail belongs in the README the user keeps. By design nothing automatic happens to the database: no migration and no seed
// run on their own, and the project ships NO migrations (TypeORM never syncs the schema: `synchronize: false`).
// The user defines their entities and creates their own migrations, so the order is: generate, run, then
// (optionally) seed. See DB docs: migration:generate compares entities with the live database.

// Engines for which the generated docker-compose.yml has a `db` service (see DB_DRIVERS in generator.ts).
const COMPOSE_DRIVERS = new Set(['postgres', 'mysql', 'mariadb']);

export interface Step {
    command: string;
    note?:   string;
}

export function firstRunSteps(opts: { hasDb: boolean; hasAuth: boolean; dbDriver: string }): Step[] {
    const steps: Step[] = [{ command: 'cp .env.example .env', note: 'fill in your values' }];

    if (opts.hasDb) {
        if (COMPOSE_DRIVERS.has(opts.dbDriver)) {
            steps.push({ command: 'docker compose up -d db', note: 'start the database (or point .env at your own)' });
        }
        steps.push({
            command: 'npm run migration:generate -- src/database/migrations/Init',
            note:    'your first migration, generated from your entities (none is shipped)',
        });
        steps.push({ command: 'npm run migration:run', note: 'apply pending migrations' });
    }
    if (opts.hasAuth) {
        steps.push({ command: 'npm run seed', note: 'optional: the roles + root user seed that ships with Auth' });
    }
    steps.push({ command: 'npm run start:dev' });
    return steps;
}

// Lines of a shell block with the notes aligned as trailing comments.
export function renderSteps(steps: Step[]): string[] {
    const width = Math.max(...steps.filter(s => s.note).map(s => s.command.length), 0);
    return steps.map(s => s.note ? `${s.command.padEnd(width)}  # ${s.note}` : s.command);
}
