import { describe, it, expect } from 'vitest';
import { buildMainTs } from './main-ts';
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

describe('buildMainTs', () => {
    it('always enables shutdown hooks, before the server starts listening', () => {
        for (const manifests of [[], [fakeManifest('database')], [fakeManifest('auth'), fakeManifest('database'), fakeManifest('mailer')]]) {
            const result = buildMainTs(manifests, 'postgres');
            expect(result).toContain('app.enableShutdownHooks();');
            expect(result.indexOf('app.enableShutdownHooks();')).toBeLessThan(result.indexOf('app.listen('));
        }
    });

    it('omits auth/db-only lines when neither plugin is active', () => {
        const result = buildMainTs([], 'postgres');
        expect(result).not.toContain('JwtConfig');
        expect(result).not.toContain('DatabaseConfig');
        expect(result).not.toContain("from 'pg'");
        expect(result).toContain('bootstrap();');
    });

    it('includes the JwtConfig import and jwtActive banner field only when auth is active', () => {
        const result = buildMainTs([fakeManifest('auth')], 'postgres');
        expect(result).toContain(`import { JwtConfig } from './app/auth/config/jwt.config.js';`);
        expect(result).toContain('jwtActive: jwtCfg.isActive,');
    });

    it('includes the DatabaseConfig import and db banner fields only when database is active', () => {
        const result = buildMainTs([fakeManifest('database')], 'postgres');
        expect(result).toContain(`import { DatabaseConfig } from './database/config/database.config.js';`);
        expect(result).toContain('dbLogs:    dbCfg.logging,');
    });

    it('only imports the pg BigInt type-parser fix when the driver is postgres', () => {
        const withPg = buildMainTs([fakeManifest('database')], 'postgres');
        expect(withPg).toContain(`import { types } from 'pg';`);

        const withMysql = buildMainTs([fakeManifest('database')], 'mysql');
        expect(withMysql).not.toContain(`from 'pg'`);
    });

    it('every relative import carries an explicit .js extension', () => {
        const result = buildMainTs([fakeManifest('auth'), fakeManifest('database')], 'postgres');
        const relativeImports = [...result.matchAll(/from\s+'(\.[^']+)'/g)].map(m => m[1]);
        expect(relativeImports.length).toBeGreaterThan(0);
        for (const spec of relativeImports) expect(spec).toMatch(/\.js$/);
    });

    it('wires ObserveInstrument into NestFactory.create only when observe is active', () => {
        const without = buildMainTs([], 'postgres');
        expect(without).not.toContain('ObserveInstrument');
        expect(without).toContain('NestFactory.create(AppModule, { logger });');

        const withObserve = buildMainTs([fakeManifest('observe')], 'postgres');
        expect(withObserve).toContain(`import { ObserveInstrument } from './plugins/observe/observe.instrument.js';`);
        expect(withObserve).toContain('NestFactory.create(AppModule, { logger, instrument: ObserveInstrument });');
        expect(withObserve).toContain('observeConfigured: !!process.env.OBSERVE_APP_KEY,');
    });

    it('applies security headers before anything else is registered, for every project', () => {
        for (const manifests of [[], [fakeManifest('auth'), fakeManifest('database')]]) {
            const result = buildMainTs(manifests, 'postgres');
            expect(result).toContain("import helmet from 'helmet';");
            expect(result).toContain('app.use(helmet(');
            expect(result.indexOf('app.use(helmet(')).toBeLessThan(result.indexOf('app.enableCors('));
        }
    });

    it('trusts a reverse proxy only when TRUST_PROXY asks for it', () => {
        const result = buildMainTs([], 'postgres');
        expect(result).toContain('parseTrustProxy(cfg.trustProxy)');
        expect(result).toContain("set('trust proxy', trustProxy)");
    });

    it('names the application from APP_NAME instead of repeating the project name', () => {
        const result = buildMainTs([], 'postgres');
        expect(result).toContain('title:       APP_NAME,');
        expect(result).toContain('logServerStatus(cfg, APP_NAME,');
    });
});
