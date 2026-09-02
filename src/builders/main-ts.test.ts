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
    it('omits auth/db-only lines when neither plugin is active', () => {
        const result = buildMainTs([], 'postgres', 'my-api');
        expect(result).not.toContain('JwtConfig');
        expect(result).not.toContain('DatabaseConfig');
        expect(result).not.toContain("from 'pg'");
        expect(result).toContain('bootstrap();');
    });

    it('includes the JwtConfig import and jwtActive banner field only when auth is active', () => {
        const result = buildMainTs([fakeManifest('auth')], 'postgres', 'my-api');
        expect(result).toContain(`import { JwtConfig } from './app/auth/config/jwt.config.js';`);
        expect(result).toContain('jwtActive: jwtCfg.isActive,');
    });

    it('includes the DatabaseConfig import and db banner fields only when database is active', () => {
        const result = buildMainTs([fakeManifest('database')], 'postgres', 'my-api');
        expect(result).toContain(`import { DatabaseConfig } from './database/config/database.config.js';`);
        expect(result).toContain('dbLogs:    dbCfg.logging,');
    });

    it('only imports the pg BigInt type-parser fix when the driver is postgres', () => {
        const withPg = buildMainTs([fakeManifest('database')], 'postgres', 'my-api');
        expect(withPg).toContain(`import { types } from 'pg';`);

        const withSqlite = buildMainTs([fakeManifest('database')], 'sqlite', 'my-api');
        expect(withSqlite).not.toContain(`from 'pg'`);
    });

    it('every relative import carries an explicit .js extension', () => {
        const result = buildMainTs([fakeManifest('auth'), fakeManifest('database')], 'postgres', 'my-api');
        const relativeImports = [...result.matchAll(/from\s+'(\.[^']+)'/g)].map(m => m[1]);
        expect(relativeImports.length).toBeGreaterThan(0);
        for (const spec of relativeImports) expect(spec).toMatch(/\.js$/);
    });
});
