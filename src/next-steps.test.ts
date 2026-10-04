import { describe, it, expect } from 'vitest';
import { firstRunSteps, renderSteps } from './next-steps';

const commands = (opts: Parameters<typeof firstRunSteps>[0]) => firstRunSteps(opts).map(s => s.command);

describe('firstRunSteps', () => {
    it('is just env + start when there is no database', () => {
        expect(commands({ hasDb: false, hasAuth: false, dbDriver: 'postgres' }))
            .toEqual(['cp .env.example .env', 'npm run start:dev']);
    });

    it('generates the initial migration BEFORE running it and seeding (there is no migration yet)', () => {
        const cmds = commands({ hasDb: true, hasAuth: true, dbDriver: 'postgres' });
        const generate = cmds.findIndex(c => c.includes('migration:generate'));
        const run      = cmds.indexOf('npm run migration:run');
        const seed     = cmds.indexOf('npm run seed');
        expect(generate).toBeGreaterThan(-1);
        expect(generate).toBeLessThan(run);
        expect(run).toBeLessThan(seed);
        expect(cmds[cmds.length - 1]).toBe('npm run start:dev');
    });

    it('starts the compose database only for engines that have a compose service', () => {
        for (const dbDriver of ['postgres', 'mysql', 'mariadb']) {
            expect(commands({ hasDb: true, hasAuth: false, dbDriver })).toContain('docker compose up -d db');
        }
        for (const dbDriver of ['mssql']) {
            expect(commands({ hasDb: true, hasAuth: false, dbDriver })).not.toContain('docker compose up -d db');
        }
    });

    it('only seeds with Auth, the plugin that owns the roles and users', () => {
        expect(commands({ hasDb: true, hasAuth: false, dbDriver: 'postgres' })).not.toContain('npm run seed');
        expect(commands({ hasDb: true, hasAuth: true,  dbDriver: 'postgres' })).toContain('npm run seed');
    });
});

describe('renderSteps', () => {
    it('aligns the notes as comments and leaves note-less steps bare', () => {
        const lines = renderSteps([{ command: 'a', note: 'x' }, { command: 'long-command', note: 'y' }, { command: 'z' }]);
        expect(lines).toEqual(['a             # x', 'long-command  # y', 'z']);
    });
});
