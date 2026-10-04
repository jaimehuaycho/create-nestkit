import { describe, it, expect } from 'vitest';
import { buildDockerfile } from './dockerfile';
import { Manifest } from '../generator';

function fakeManifest(id: string, docker?: Manifest['docker']): Manifest {
    return {
        id,
        requires: [],
        appModule: { imports: [], modules: [] },
        dependencies: { prod: [], dev: [] },
        scripts: {},
        docker,
    };
}

describe('buildDockerfile', () => {
    it('uses the alpine base when no plugin requires debian', () => {
        const result = buildDockerfile([fakeManifest('database'), fakeManifest('mailer')]);
        expect(result).toContain('node:22-alpine');
        expect(result).not.toContain('bookworm-slim');
    });

    it('switches to the debian base when a plugin declares docker.base = "debian"', () => {
        const result = buildDockerfile([fakeManifest('database'), fakeManifest('pdf', { base: 'debian' })]);
        expect(result).toContain('node:22-bookworm-slim');
        expect(result).toContain('puppeteer'); // debian stage installs Chrome system deps
    });

    it('always exposes port 3000 and defines a healthcheck', () => {
        const result = buildDockerfile([]);
        expect(result).toContain('EXPOSE 3000');
        expect(result).toContain('HEALTHCHECK');
    });

    it('healthchecks with Node itself, never wget or curl (the Debian slim image has neither)', () => {
        for (const manifests of [[], [fakeManifest('pdf', { base: 'debian' })]]) {
            const result = buildDockerfile(manifests);
            expect(result).toContain('HEALTHCHECK');
            expect(result).toContain('fetch(');
            expect(result).not.toMatch(/\bwget\b|\bcurl\b/);
        }
    });
});

