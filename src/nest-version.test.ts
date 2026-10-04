import { describe, it, expect } from 'vitest';
import { NEST } from './nest-version';

// The package targets ONE Nest major (the latest). These tests keep the profile internally consistent.
describe('NEST profile', () => {
    it('targets a single major and asks the Nest CLI for exactly that major', () => {
        expect(NEST.major).toBe(12);
        expect(NEST.cliRange).toBe(`^${NEST.major}`);
    });

    it('pins every coupled @nestjs/* package to the same major', () => {
        for (const [name, range] of Object.entries(NEST.packages)) {
            expect(name.startsWith('@nestjs/'), name).toBe(true);
            expect(range, name).toBe(`^${NEST.major}`);
        }
    });

    it('keeps `nest new` free of the observability prompt', () => {
        expect(NEST.newFlags).toContain('--no-observe');
    });

    it('has no leftover multi-version machinery', async () => {
        const mod = await import('./nest-version');
        expect(Object.keys(mod)).toEqual(['NEST']);
    });
});
