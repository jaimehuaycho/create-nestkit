import { describe, it, expect } from 'vitest';
import { buildHealthController } from './health-controller';
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

describe('buildHealthController', () => {
    it('omits the DB ping check and TypeOrmHealthIndicator entirely when database is inactive', () => {
        const result = buildHealthController([]);
        expect(result).not.toContain('TypeOrmHealthIndicator');
        expect(result).not.toContain("pingCheck('database')");
        expect(result).toContain('MemoryHealthIndicator');
        expect(result).toContain('DiskHealthIndicator');
    });

    it('includes the DB ping check only when database is active', () => {
        const result = buildHealthController([fakeManifest('database')]);
        expect(result).toContain('TypeOrmHealthIndicator');
        expect(result).toContain("pingCheck('database')");
    });

    it('omits @Public() and its import when auth is inactive', () => {
        const result = buildHealthController([]);
        expect(result).not.toContain('@Public()');
        expect(result).not.toContain("import { Public }");
    });

    it('includes @Public() and its import only when auth is active', () => {
        const result = buildHealthController([fakeManifest('auth')]);
        expect(result).toContain('@Public()');
        expect(result).toContain("import { Public } from '../../auth/decorators/index.js';");
    });

    it('always wires HealthCheckService and the memory/disk checks regardless of plugins', () => {
        const result = buildHealthController([fakeManifest('database'), fakeManifest('auth')]);
        expect(result).toContain('HealthCheckService');
        expect(result).toContain("checkHeap('memory_heap'");
        expect(result).toContain("checkStorage('disk'");
    });
});
