import { Manifest } from '../generator';

// .claude/settings.json for the generated project. Unlike CLAUDE.md and rules (guidance Claude may
// ignore), permissions and hooks are enforced by Claude Code itself, so anything that must hold
// every time lives here. Shared and committed; personal overrides go in settings.local.json.

// Secrets Claude must not read. A Read deny also blocks Edit/Write on the same path.
// .env.example is intentionally absent: it is documentation, not a secret.
const SECRET_FILES = ['.env', '.env.local', '.env.development', '.env.test', '.env.production'];

const HOOK_DIR = '"$CLAUDE_PROJECT_DIR"/.claude/hooks';

export interface ClaudeSettings {
    $schema:     string;
    permissions: { allow: string[]; ask: string[]; deny: string[] };
    hooks:       Record<string, { matcher: string; hooks: { type: 'command'; command: string }[] }[]>;
}

export function buildSettings(manifests: Manifest[]): ClaudeSettings {
    const hasDb = manifests.some(m => m.id === 'database');

    const allow = [
        // The verification loop: Claude should be able to run these without asking.
        'Bash(npm test *)',
        'Bash(npm run typecheck *)',
        'Bash(npm run lint *)',
        'Bash(npm run build *)',
        'Bash(npm run format *)',
        'Bash(npx tsc --noEmit *)',
        // Read-only git, so Claude can see state and history.
        'Bash(git status *)',
        'Bash(git diff *)',
        'Bash(git log *)',
        'Bash(git show *)',
    ];

    // Actions with side effects outside the working tree: ask first.
    const ask = [
        ...(hasDb ? [
            'Bash(npm run migration:run *)',
            'Bash(npm run migration:revert *)',
            'Bash(npm run seed *)',
        ] : []),
        'Bash(git push *)',
        'Bash(git reset --hard *)',
    ];

    const deny = SECRET_FILES.map(f => `Read(./${f})`);

    return {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        permissions: { allow, ask, deny },
        hooks: {
            PreToolUse: [{
                matcher: 'Edit|Write',
                hooks: [{ type: 'command', command: `node ${HOOK_DIR}/protect-files.cjs` }],
            }],
            PostToolUse: [{
                matcher: 'Edit|Write',
                hooks: [{ type: 'command', command: `node ${HOOK_DIR}/format.cjs` }],
            }],
        },
    };
}

export function buildSettingsJson(manifests: Manifest[]): string {
    return JSON.stringify(buildSettings(manifests), null, 2) + '\n';
}
