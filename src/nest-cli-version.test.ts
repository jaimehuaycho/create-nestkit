import { describe, it, expect } from 'vitest';
import { highestVersion, resolveNestCliVersion } from './nest-cli-version';
import { NEST } from './nest-version';

describe('highestVersion', () => {
    it('takes a single version as it is', () => {
        expect(highestVersion('12.0.10')).toBe('12.0.10');
    });

    it('compares numerically, not as text', () => {
        expect(highestVersion(['12.0.0', '12.0.9', '12.0.10'])).toBe('12.0.10');
        expect(highestVersion(['12.9.0', '12.10.0', '12.2.5'])).toBe('12.10.0');
        expect(highestVersion(['12.0.10', '12.0.2'])).toBe('12.0.10');
    });

    it('ignores prereleases and anything that is not a version', () => {
        expect(highestVersion(['12.0.0', '12.1.0-next.1', 'latest', 7, null])).toBe('12.0.0');
    });

    it('returns null when there is nothing usable', () => {
        expect(highestVersion([])).toBeNull();
        expect(highestVersion(['next'])).toBeNull();
        expect(highestVersion(undefined)).toBeNull();
    });
});

describe('resolveNestCliVersion', () => {
    it('returns the exact latest version in the range', () => {
        expect(resolveNestCliVersion(() => JSON.stringify(['12.0.0', '12.0.10']))).toBe('12.0.10');
        expect(resolveNestCliVersion(() => '"12.0.3"')).toBe('12.0.3');
    });

    it('falls back to the range when the registry cannot be asked or answers nonsense', () => {
        expect(resolveNestCliVersion(() => { throw new Error('ENOTFOUND'); })).toBe(NEST.cliRange);
        expect(resolveNestCliVersion(() => 'not json')).toBe(NEST.cliRange);
        expect(resolveNestCliVersion(() => '[]')).toBe(NEST.cliRange);
    });
});
