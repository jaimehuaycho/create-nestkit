import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildTsconfig, nestTypesOf } from './tsconfig';

const OURS = fs.readFileSync(path.join(__dirname, '..', '..', 'templates', 'base', 'tsconfig.json'), 'utf-8');
const ESM_TSCONFIG = '{ "compilerOptions": { "module": "nodenext", "types": ["vitest/globals", "node"] } }';
const CJS_TSCONFIG = '{ "compilerOptions": { "module": "nodenext", "types": ["node", "jest"] } }';

describe('nestTypesOf', () => {
    it('reads the types of an ESM and of a CommonJS project', () => {
        expect(nestTypesOf(ESM_TSCONFIG)).toEqual(['vitest/globals', 'node']);
        expect(nestTypesOf(CJS_TSCONFIG)).toEqual(['node', 'jest']);
    });

    it('still reads them when the file is not plain JSON', () => {
        expect(nestTypesOf('{\n  // comment\n  "compilerOptions": { "types": ["node", "jest"], }\n}')).toEqual(['node', 'jest']);
    });

    it('returns null when there are none', () => {
        expect(nestTypesOf('{ "compilerOptions": {} }')).toBeNull();
        expect(nestTypesOf('nothing here')).toBeNull();
    });
});

describe('buildTsconfig', () => {
    it('keeps every option of ours and adds the test runner types of the project', () => {
        const esm = JSON.parse(buildTsconfig(OURS, ESM_TSCONFIG));
        const cjs = JSON.parse(buildTsconfig(OURS, CJS_TSCONFIG));
        expect(esm.compilerOptions.types).toEqual(['vitest/globals', 'node']);
        expect(cjs.compilerOptions.types).toEqual(['node', 'jest']);
        for (const config of [esm, cjs]) {
            expect({ ...config.compilerOptions, types: undefined }).toEqual({ ...JSON.parse(OURS).compilerOptions, types: undefined });
        }
    });

    it('returns our file untouched when Nest declared no types', () => {
        expect(buildTsconfig(OURS, '{ "compilerOptions": {} }')).toBe(OURS);
        expect(buildTsconfig(OURS, 'garbage')).toBe(OURS);
    });
});
