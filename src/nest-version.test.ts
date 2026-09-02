import { describe, it, expect, afterEach } from 'vitest';
import {
    SUPPORTED_NEST_VERSIONS,
    DEFAULT_NEST_MAJOR,
    detectInstalledNestMajor,
    resolveNestVersion,
} from './nest-version';

describe('SUPPORTED_NEST_VERSIONS', () => {
    it('has a profile for the default major', () => {
        expect(SUPPORTED_NEST_VERSIONS[DEFAULT_NEST_MAJOR]).toBeDefined();
    });

    it('every profile pins a cliRange and at least one companion package', () => {
        for (const [major, profile] of Object.entries(SUPPORTED_NEST_VERSIONS)) {
            expect(profile.major).toBe(Number(major));
            expect(profile.cliRange).toMatch(/^\^\d+$/);
            expect(Object.keys(profile.packages).length).toBeGreaterThan(0);
        }
    });

    it('passes --no-observe only for majors whose `nest new` supports the flag (v12+)', () => {
        expect(SUPPORTED_NEST_VERSIONS[11].newFlags ?? []).not.toContain('--no-observe');
        expect(SUPPORTED_NEST_VERSIONS[12].newFlags).toContain('--no-observe');
    });
});

describe('detectInstalledNestMajor', () => {
    it('parses the major out of a version string from `nest --version`', () => {
        expect(detectInstalledNestMajor(() => '11.2.3\n')).toBe(11);
    });

    it('returns null when the `nest` binary is not on PATH', () => {
        expect(detectInstalledNestMajor(() => { throw new Error('command not found: nest'); })).toBeNull();
    });

    it('returns null on unparseable output', () => {
        expect(detectInstalledNestMajor(() => 'not a version')).toBeNull();
    });
});

describe('resolveNestVersion', () => {
    const ORIGINAL_ENV = process.env.NESTKIT_NEST_VERSION;
    const neverDetected = () => null;

    afterEach(() => {
        if (ORIGINAL_ENV === undefined) delete process.env.NESTKIT_NEST_VERSION;
        else process.env.NESTKIT_NEST_VERSION = ORIGINAL_ENV;
    });

    it('honors the NESTKIT_NEST_VERSION override when it is a supported major', () => {
        process.env.NESTKIT_NEST_VERSION = '11';
        expect(resolveNestVersion(neverDetected)).toBe(SUPPORTED_NEST_VERSIONS[11]);
    });

    it('ignores the override when it names an unsupported major, falling back to detection', () => {
        process.env.NESTKIT_NEST_VERSION = '999';
        expect(resolveNestVersion(neverDetected)).toBe(SUPPORTED_NEST_VERSIONS[DEFAULT_NEST_MAJOR]);
    });

    it('falls back to the default major when nothing is installed and no override is set', () => {
        delete process.env.NESTKIT_NEST_VERSION;
        expect(resolveNestVersion(neverDetected)).toBe(SUPPORTED_NEST_VERSIONS[DEFAULT_NEST_MAJOR]);
    });

    it('uses the detected major when it is supported', () => {
        delete process.env.NESTKIT_NEST_VERSION;
        expect(resolveNestVersion(() => 11)).toBe(SUPPORTED_NEST_VERSIONS[11]);
    });

    it('falls back to the default major when the detected one is not supported', () => {
        delete process.env.NESTKIT_NEST_VERSION;
        expect(resolveNestVersion(() => 7)).toBe(SUPPORTED_NEST_VERSIONS[DEFAULT_NEST_MAJOR]);
    });
});
