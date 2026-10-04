import { describe, it, expect } from 'vitest';
import { getEnvSettings } from '../templates/core/src/config/helpers/environment';

// Tests for the config helpers generated into users' projects.
describe('getEnvSettings', () => {
    it('returns the settings of a known environment and defaults to development when unset', () => {
        expect(getEnvSettings('production').swagger).toBe(false);
        expect(getEnvSettings('debug').logger).toContain('verbose');
        expect(getEnvSettings(undefined)).toEqual(getEnvSettings('development'));
    });

    it('fails with a clear message for an unknown NODE_ENV instead of returning undefined', () => {
        expect(() => getEnvSettings('bogus')).toThrow(/Invalid NODE_ENV "bogus"\. Allowed values: .*production/);
        expect(() => getEnvSettings('')).toThrow(/Invalid NODE_ENV/);
    });
});

