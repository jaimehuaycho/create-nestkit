import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

// The same entities run on PostgreSQL, MySQL, MariaDB and SQL Server. A column type written as a string only works on the engines that
// know it ('boolean' does not exist on SQL Server, 'timestamp' is a row-version counter there), so entities may name only types that
// every engine has, or the portable constructors (Date, Boolean) that TypeORM maps per engine.
const PORTABLE_STRING_TYPES = new Set(['varchar', 'int']);

function entityFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        const full = path.join(dir, e.name);
        return e.isDirectory() ? entityFiles(full) : /\.(entity|base)\.ts$|base\.entity\.ts$/.test(e.name) ? [full] : [];
    });
}

describe('entity templates stay portable across database engines', () => {
    it('only use column types every supported engine has', () => {
        const root = path.join(__dirname, '..', 'templates');
        const offenders: string[] = [];
        for (const file of entityFiles(root)) {
            for (const m of fs.readFileSync(file, 'utf8').matchAll(/type:\s*'([^']+)'/g)) {
                if (!PORTABLE_STRING_TYPES.has(m[1])) offenders.push(`${path.relative(root, file)}: type '${m[1]}'`);
            }
        }
        expect(offenders).toEqual([]);
    });
});
