import { describe, it, expect } from 'vitest';
import { NEST } from './nest-version';
import pkg from '../package.json';

// The package targets ONE Nest major (the latest). These tests keep the profile internally consistent.
describe('NEST profile', () => {
    it('targets a single major, and builds projects with that major\'s application schematic, pinned exactly', () => {
        expect(NEST.major).toBe(12);
        expect(pkg.dependencies['@nestjs/schematics']).toMatch(new RegExp(`^${NEST.major}\\.\\d+\\.\\d+$`));
    });

    it('pins every coupled @nestjs/* package to the same major', () => {
        for (const [name, range] of Object.entries(NEST.packages)) {
            expect(name.startsWith('@nestjs/'), name).toBe(true);
            expect(range, name).toBe(`^${NEST.major}`);
        }
    });

    it('has no leftover multi-version machinery', async () => {
        const mod = await import('./nest-version');
        expect(Object.keys(mod)).toEqual(['NEST']);
    });
});
