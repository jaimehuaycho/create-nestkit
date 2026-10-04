import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import { buildEnvExample } from './env-example';

describe('buildEnvExample', () => {
    let tmpDir: string;

    afterEach(() => {
        if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function makeTemplatesDir() {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-example-'));
        const mailerDir = path.join(tmpDir, 'plugins', 'mailer');
        fs.mkdirSync(mailerDir, { recursive: true });
        fs.writeFileSync(path.join(mailerDir, '_env.example.fragment'), '\n# Mailer\nSMTP_HOST=localhost\n');
        return tmpDir;
    }

    it('always includes the server section, even with no plugins', () => {
        const templatesDir = makeTemplatesDir();
        const result = buildEnvExample([], 'postgres', templatesDir);
        expect(result).toContain('NODE_ENV=development');
    });

    it('substitutes the driver-specific block for the database plugin', () => {
        const templatesDir = makeTemplatesDir();
        const postgres = buildEnvExample(['database'], 'postgres', templatesDir);
        expect(postgres).toContain('DB_TYPE=postgres');
        expect(postgres).toContain('DB_PORT=5432');

        const mssql = buildEnvExample(['database'], 'mssql', templatesDir);
        expect(mssql).toContain('DB_TYPE=mssql');
        expect(mssql).toContain('DB_PORT=1433');
    });

    it('falls back to the postgres block for an unknown driver', () => {
        const templatesDir = makeTemplatesDir();
        const result = buildEnvExample(['database'], 'nonexistent-driver', templatesDir);
        expect(result).toContain('DB_TYPE=postgres');
    });

    it('appends a plugin fragment for any non-database plugin', () => {
        const templatesDir = makeTemplatesDir();
        const result = buildEnvExample(['mailer'], 'postgres', templatesDir);
        expect(result).toContain('SMTP_HOST=localhost');
    });

    describe('layout', () => {
        const TEMPLATES = path.join(__dirname, '..', '..', 'templates');
        const ALL = ['database', 'auth', 'mailer', 'socket', 'pdf', 'observe'];

        it('separates every section with exactly one blank line, in every driver and plugin combination', () => {
            for (const driver of ['postgres', 'mysql', 'mariadb', 'mssql']) {
                for (const ids of [[], ['database'], ['database', 'auth'], ALL]) {
                    const result = buildEnvExample(ids, driver, TEMPLATES);
                    expect(result, `${driver} ${ids}`).not.toMatch(/\n\n\n/);          // never two blank lines
                    expect(result.endsWith('\n') && !result.endsWith('\n\n')).toBe(true); // one final newline
                    expect(result.startsWith('\n')).toBe(false);
                }
            }
        });

        it('puts a blank line before every section header, so no section starts under the previous variable', () => {
            const lines = buildEnvExample(ALL, 'postgres', TEMPLATES).split('\n');
            lines.forEach((line, i) => {
                const startsComment = line.startsWith('#') && i > 0 && !lines[i - 1].startsWith('#') && lines[i - 1] !== '';
                expect(startsComment, `line ${i + 1} "${line}" follows "${lines[i - 1]}" without a blank line`).toBe(false);
            });
        });

        it('keeps every variable of every selected plugin', () => {
            const result = buildEnvExample(ALL, 'postgres', TEMPLATES);
            for (const name of ['NODE_ENV', 'DB_TYPE', 'SEED_ROOT_EMAIL', 'JWT_SECRET', 'MAILER_TRANSPORT', 'OBSERVE_APP_KEY']) {
                expect(result).toContain(name);
            }
        });
    });

    it('uses driver names TypeORM 1.x accepts (it rejects unknown ones with "Wrong driver: x given")', () => {
        const TYPEORM_DRIVERS = ['postgres', 'mysql', 'mariadb', 'mssql'];
        const TEMPLATES = path.join(__dirname, '..', '..', 'templates');
        for (const driver of ['postgres', 'mysql', 'mariadb', 'mssql']) {
            const type = /^DB_TYPE=(.+)$/m.exec(buildEnvExample(['database'], driver, TEMPLATES))?.[1];
            expect(TYPEORM_DRIVERS, `${driver} -> ${type}`).toContain(type);
        }
    });
});

