import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { validateProjectName, validateTargetDir } from './validate';

describe('validateProjectName', () => {
    it.each(['my-api', 'my_api', 'my.api', 'MyApi', 'api2', 'a'])('accepts %s', (name) => {
        expect(validateProjectName(name)).toBeUndefined();
    });

    it.each(['', '   '])('requires a non-blank name (%j)', (name) => {
        expect(validateProjectName(name)).toMatch(/required/);
    });

    it.each([
        'my api',          // space
        'api; rm -rf ~',   // command separator
        'api && whoami',   // command chaining
        '$(whoami)',       // command substitution
        '`whoami`',        // backticks
        'a|b',             // pipe
        'a>b',             // redirect
        "it's",            // quote
        '../escape',       // path traversal
        'nested/dir',      // path separator
        'back\\slash',     // Windows separator
        '@scope/pkg',      // scoped names are not supported
        '-leading-dash',   // would be parsed as a flag
        '.hidden',         // must start with a letter or number
        'trailing ',       // surrounding whitespace is not trimmed silently
    ])('rejects %j', (name) => {
        expect(validateProjectName(name)).toBeDefined();
    });

    it('rejects names over npm\'s 214 character limit', () => {
        expect(validateProjectName('a'.repeat(215))).toMatch(/214/);
        expect(validateProjectName('a'.repeat(214))).toBeUndefined();
    });

    it('rejects reserved names', () => {
        expect(validateProjectName('node_modules')).toMatch(/reserved/);
    });
});

describe('validateTargetDir', () => {
    it('accepts a path that does not exist', () => {
        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'nestkit-validate-'));
        expect(validateTargetDir(path.join(base, 'fresh'))).toBeUndefined();
    });

    it('rejects an existing directory', () => {
        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'nestkit-validate-'));
        expect(validateTargetDir(base)).toMatch(/already exists/);
    });

    it('rejects an existing file', () => {
        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'nestkit-validate-'));
        const file = path.join(base, 'taken');
        fs.writeFileSync(file, '');
        expect(validateTargetDir(file)).toMatch(/already exists/);
    });
});
