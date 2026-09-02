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

        const sqlite = buildEnvExample(['database'], 'sqlite', templatesDir);
        expect(sqlite).toContain('DB_TYPE=sqlite');
        expect(sqlite).not.toContain('DB_PORT'); // sqlite has no network port
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
});
