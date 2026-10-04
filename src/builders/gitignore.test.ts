import { describe, it, expect } from 'vitest';
import { withClaudeIgnores } from './gitignore';

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
