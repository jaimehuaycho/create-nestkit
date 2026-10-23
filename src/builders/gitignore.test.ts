import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildGitignore, withClaudeIgnores } from './gitignore';

describe('withClaudeIgnores', () => {
    it('appends the personal Claude Code files to an existing .gitignore', () => {
        const result = withClaudeIgnores('/dist\n/node_modules\n');
        expect(result.startsWith('/dist\n/node_modules\n')).toBe(true);
        expect(result).toContain('.claude/settings.local.json');
        expect(result).toContain('CLAUDE.local.md');
    });

    it('is idempotent', () => {
        const once = withClaudeIgnores('/dist\n');
        expect(withClaudeIgnores(once)).toBe(once);
    });

    it('only adds what is missing', () => {
        const result = withClaudeIgnores('CLAUDE.local.md\n');
        expect(result.match(/CLAUDE\.local\.md/g)).toHaveLength(1);
        expect(result).toContain('.claude/settings.local.json');
    });

    it('handles a missing trailing newline and an empty file', () => {
        expect(withClaudeIgnores('/dist')).toMatch(/^\/dist\n\n# Claude Code/);
        expect(withClaudeIgnores('')).toMatch(/^\n# Claude Code|^# Claude Code/);
    });
});

// `nest new --skip-git` writes no .gitignore (create-nestkit always skips git): the generated file must stand on its own.
describe('buildGitignore', () => {
    // Asks git itself, in a throwaway repository, instead of only looking for strings.
    function ignoredBy(gitignore: string, files: string[]): Record<string, boolean> {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nestkit-gitignore-'));
        try {
            execFileSync('git', ['init', '-q'], { cwd: dir });
            fs.writeFileSync(path.join(dir, '.gitignore'), gitignore);
            return Object.fromEntries(files.map((file) => {
                try {
                    execFileSync('git', ['check-ignore', '-q', '--no-index', file], { cwd: dir });
                    return [file, true];
                } catch {
                    return [file, false];
                }
            }));
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }

    const SECRETS_AND_OUTPUT = ['.env', '.env.local', '.env.production', '.env.development.local', 'node_modules/x/index.js', 'dist/main.js', 'coverage/lcov.info', 'app.log', '.DS_Store', '.claude/settings.local.json', 'CLAUDE.local.md'];
    const MUST_STAY_TRACKED  = ['.env.example', 'src/main.ts', 'package.json', 'package-lock.json', 'tsconfig.json', 'nest-cli.json', '.claude/CLAUDE.md', '.claude/settings.json'];

    it('builds a complete file when there is none', () => {
        const result = ignoredBy(buildGitignore(''), [...SECRETS_AND_OUTPUT, ...MUST_STAY_TRACKED]);
        for (const file of SECRETS_AND_OUTPUT) expect(result[file], `${file} should be ignored`).toBe(true);
        for (const file of MUST_STAY_TRACKED)  expect(result[file], `${file} should stay tracked`).toBe(false);
    });

    it('treats a blank file like a missing one', () => {
        expect(buildGitignore('  \n')).toContain('/node_modules');
    });

    it('keeps what exists and only adds the required lines that are missing', () => {
        const result = buildGitignore('/dist\n/node_modules\nmy-own-folder/\n');
        expect(result.startsWith('/dist\n/node_modules\nmy-own-folder/\n')).toBe(true);
        expect(result.match(/^\/node_modules$/gm)).toHaveLength(1);
        expect(ignoredBy(result, ['.env', '.env.production', '.env.example', 'my-own-folder/a'])).toEqual({
            '.env': true, '.env.production': true, '.env.example': false, 'my-own-folder/a': true,
        });
    });

    it('is idempotent', () => {
        for (const start of ['', '/dist\n', buildGitignore('')]) {
            const once = buildGitignore(start);
            expect(buildGitignore(once)).toBe(once);
        }
    });

    it('never ignores .env.example, even after the .env.* line', () => {
        const lines = buildGitignore('').split('\n');
        expect(lines.indexOf('!.env.example')).toBeGreaterThan(lines.indexOf('.env.*'));
    });
});
