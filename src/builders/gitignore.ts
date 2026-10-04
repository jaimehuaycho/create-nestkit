// Lines a generated project should ignore so personal Claude Code state never gets committed.
// `nest new` writes the base .gitignore; we only append what is missing, so this is idempotent.
const CLAUDE_IGNORES = ['.claude/settings.local.json', 'CLAUDE.local.md'];

export function withClaudeIgnores(existing: string): string {
    const present = new Set(existing.split(/\r?\n/).map(line => line.trim()));
    const missing = CLAUDE_IGNORES.filter(line => !present.has(line));
    if (missing.length === 0) return existing;

    const separator = existing.endsWith('\n') || existing === '' ? '' : '\n';
    return `${existing}${separator}\n# Claude Code (personal, never committed)\n${missing.join('\n')}\n`;
}
