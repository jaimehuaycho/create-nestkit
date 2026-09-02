import { describe, it, expect } from 'vitest';
import { buildDockerCompose } from './docker-compose';

const POSTGRES_DRIVER = {
    composeService: '  db:\n    image: postgres:16-alpine',
    composeVolume:  '  db_data:',
    appDependsOn:   'db:\n        condition: service_healthy',
};

const SQLITE_DRIVER = {}; // no compose service — file-based DB

describe('buildDockerCompose', () => {
    it('always defines the app service', () => {
        const result = buildDockerCompose([], SQLITE_DRIVER);
        expect(result).toContain('services:');
        expect(result).toContain('  app:');
        expect(result).toContain('build: .');
    });

    it('omits the db service and depends_on when the database plugin is absent', () => {
        const result = buildDockerCompose(['mailer'], POSTGRES_DRIVER);
        expect(result).not.toContain('depends_on');
        expect(result).not.toContain('db:');
    });

    it('adds the db service, volume, and depends_on when database is active with a networked driver', () => {
        const result = buildDockerCompose(['database'], POSTGRES_DRIVER);
        expect(result).toContain('depends_on');
        expect(result).toContain('service_healthy');
        expect(result).toContain('postgres:16-alpine');
        expect(result).toContain('volumes:');
    });

    it('adds no db service for a file-based driver even when database is active', () => {
        const result = buildDockerCompose(['database'], SQLITE_DRIVER);
        expect(result).not.toContain('depends_on');
        expect(result).not.toContain('volumes:');
    });
});
