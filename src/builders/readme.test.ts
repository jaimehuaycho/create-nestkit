import { describe, it, expect } from 'vitest';
import { buildReadme } from './readme';
import { Manifest } from '../generator';

function fakeManifest(id: string): Manifest {
    return {
        id,
        requires: [],
        appModule: { imports: [], modules: [] },
        dependencies: { prod: [], dev: [] },
        scripts: {},
    };
}

describe('buildReadme', () => {
    it('replaces Nest boilerplate with a bare-scaffold description when no plugins are active', () => {
        const result = buildReadme([], 'postgres', 'my-api', 11);
        expect(result).toContain('# my-api');
        expect(result).toContain('NestJS 11');
        expect(result).not.toContain('nestjs.com');
        expect(result).not.toContain('TypeORM');
        expect(result).not.toContain('migration:run');
    });

    it('mentions the DB driver and migration steps only when database is active', () => {
        const withDb = buildReadme([fakeManifest('database')], 'mysql', 'my-api', 12);
        expect(withDb).toContain('MySQL');
        expect(withDb).toContain('migration:run');

        const withoutDb = buildReadme([fakeManifest('mailer')], 'mysql', 'my-api', 12);
        expect(withoutDb).not.toContain('migration:run');
    });

    it('surfaces the seed step in Getting Started only when auth is active (bare seed does nothing)', () => {
        const dbOnly = buildReadme([fakeManifest('database')], 'postgres', 'my-api', 12);
        const gettingStartedDbOnly = dbOnly.slice(dbOnly.indexOf('## Getting Started'), dbOnly.indexOf('## Project Structure'));
        expect(gettingStartedDbOnly).not.toContain('npm run seed');

        const withAuth = buildReadme([fakeManifest('database'), fakeManifest('auth')], 'postgres', 'my-api', 12);
        const gettingStartedAuth = withAuth.slice(withAuth.indexOf('## Getting Started'), withAuth.indexOf('## Project Structure'));
        expect(gettingStartedAuth).toContain('npm run seed');
    });

    it('lists /nest-module and /db-map only when database is active', () => {
        const withoutDb = buildReadme([fakeManifest('mailer')], 'postgres', 'my-api', 12);
        expect(withoutDb).not.toContain('/nest-module');
        expect(withoutDb).not.toContain('/db-map');

        const withDb = buildReadme([fakeManifest('database')], 'postgres', 'my-api', 12);
        expect(withDb).toContain('/nest-module');
        expect(withDb).toContain('/db-map');
    });

    it('mentions the observe.nestjs.com signup only when observe is active', () => {
        const without = buildReadme([fakeManifest('database')], 'postgres', 'my-api', 12);
        expect(without).not.toContain('observe.nestjs.com');

        const withObserve = buildReadme([fakeManifest('observe')], 'postgres', 'my-api', 12);
        expect(withObserve).toContain('observe.nestjs.com');
        expect(withObserve).toContain('OBSERVE_APP_KEY');
    });

    it('mentions each active plugin by name', () => {
        const result = buildReadme(
            [fakeManifest('mailer'), fakeManifest('socket'), fakeManifest('pdf')],
            'postgres', 'my-api', 12,
        );
        expect(result).toContain('Mailer');
        expect(result).toContain('WebSockets');
        expect(result).toContain('PDF generation');
    });

    it('gives a first-run sequence that works: generate the initial migration before running it', () => {
        const md = buildReadme([fakeManifest('database'), fakeManifest('auth')], 'postgres', 'my-api', 12);
        const generate = md.indexOf('migration:generate -- src/database/migrations/Init');
        expect(generate).toBeGreaterThan(-1);
        expect(generate).toBeLessThan(md.indexOf('npm run migration:run'));
        expect(md.indexOf('npm run migration:run')).toBeLessThan(md.indexOf('npm run seed'));
        expect(md).not.toContain('apply the initial schema');
        expect(md).toContain('docker compose up -d db');
    });

    it('does not tell sqlite users to start a compose database', () => {
        expect(buildReadme([fakeManifest('database')], 'sqlite', 'my-api', 12)).not.toContain('docker compose up -d db');
    });

    it('states that no migration or seed runs automatically or ships, only when a database is present', () => {
        const withDb = buildReadme([fakeManifest('database')], 'postgres', 'my-api', 12);
        expect(withDb).toMatch(/No migrations or seeds run automatically, and none are shipped/);
        expect(buildReadme([fakeManifest('mailer')], 'postgres', 'my-api', 12)).not.toMatch(/No migrations/);
    });

    it('explains the npm audit noise and the install-script policy', () => {
        const md = buildReadme([], 'postgres', 'my-api', 12);
        expect(md).toContain('npm audit --omit=dev');
        expect(md).toContain('allowScripts');
    });
});

