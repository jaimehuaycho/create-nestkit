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

    it('lists /nestjs/module and /db/map only when database is active', () => {
        const withoutDb = buildReadme([fakeManifest('mailer')], 'postgres', 'my-api', 12);
        expect(withoutDb).not.toContain('/nestjs/module');
        expect(withoutDb).not.toContain('/db/map');

        const withDb = buildReadme([fakeManifest('database')], 'postgres', 'my-api', 12);
        expect(withDb).toContain('/nestjs/module');
        expect(withDb).toContain('/db/map');
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
});
