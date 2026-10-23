import { describe, it, expect } from 'vitest';
import { buildDockerCompose } from './docker-compose';

const POSTGRES_DRIVER = {
    composeService: '  db:\n    image: postgres:16-alpine',
    composeVolume:  '  db_data:',
    appDependsOn:   'db:\n        condition: service_healthy',
    containerPort:  5432,
};

const NO_COMPOSE_DRIVER = {}; // e.g. SQL Server: left to the user, no compose service

describe('buildDockerCompose', () => {
    it('always defines the app service', () => {
        const result = buildDockerCompose([], NO_COMPOSE_DRIVER);
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
        const result = buildDockerCompose(['database'], NO_COMPOSE_DRIVER);
        expect(result).not.toContain('depends_on');
        expect(result).not.toContain('volumes:');
    });

    it('runs the app on port 3000 inside the container whatever PORT says in .env', () => {
        for (const plugins of [[], ['mailer'], ['database']]) {
            const result = buildDockerCompose(plugins, POSTGRES_DRIVER);
            expect(result).toContain('    environment:\n      PORT: 3000');
            expect(result).toContain('env_file: .env');
        }
    });

    it('points the app at the db service on the engine\'s container port, not at localhost or the published port', () => {
        const result = buildDockerCompose(['database'], POSTGRES_DRIVER);
        expect(result).toContain('      DB_HOST: db\n      DB_PORT: 5432');
        expect(buildDockerCompose(['database'], { ...POSTGRES_DRIVER, containerPort: 3306 })).toContain('DB_PORT: 3306');
    });

    it('sets no database variables without the database plugin or without a compose service', () => {
        expect(buildDockerCompose(['mailer'], POSTGRES_DRIVER)).not.toMatch(/DB_HOST:/);
        expect(buildDockerCompose(['database'], NO_COMPOSE_DRIVER)).not.toMatch(/DB_HOST:/);
    });
});
