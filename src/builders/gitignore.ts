// What a generated project must never commit. `nest new --skip-git` writes NO .gitignore: the CLI creates it only when it also runs `git init`
// (it is not published inside @nestjs/schematics either), and create-nestkit always skips git, so the project would be left with nothing
// ignored, `.env` and `node_modules` included. This is Nest's own default list (@nestjs/cli, MIT) plus `.env.*` (the CLI misses `.env.production`).
const DEFAULT_GITIGNORE = `# compiled output
/dist
/node_modules
/build

# TypeScript build cache
*.tsbuildinfo

# Logs
logs
*.log
npm-debug.log*
pnpm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# OS
.DS_Store

# Tests
/coverage
/.nyc_output

# IDEs and editors
/.idea
.project
.classpath
.c9/
*.launch
.settings/
*.sublime-workspace

# IDE - VSCode
.vscode/*
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
!.vscode/extensions.json

# dotenv environment variable files (secrets): only the example is committed
.env
.env.*
!.env.example

# temp directory
.temp
.tmp

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Diagnostic reports (https://nodejs.org/api/report.html)
report.[0-9]*.[0-9]*.[0-9]*.[0-9]*.json
`;

// Lines whose absence would be a security or hygiene problem, whoever wrote the file.
const REQUIRED_IGNORES = ['/node_modules', '/dist', '.env', '.env.*', '!.env.example'];

// Lines a generated project should ignore so personal Claude Code state never gets committed.
const CLAUDE_IGNORES = ['.claude/settings.local.json', 'CLAUDE.local.md'];

function appendMissing(existing: string, wanted: string[], heading: string): string {
    const present = new Set(existing.split(/\r?\n/).map(line => line.trim()));
    const missing = wanted.filter(line => !present.has(line));
    if (missing.length === 0) return existing;

    const separator = existing.endsWith('\n') || existing === '' ? '' : '\n';
    return `${existing}${separator}\n# ${heading}\n${missing.join('\n')}\n`;
}

export function withClaudeIgnores(existing: string): string {
    return appendMissing(existing, CLAUDE_IGNORES, 'Claude Code (personal, never committed)');
}

// The .gitignore of a generated project: Nest's default when there is none, whatever exists plus the required lines otherwise,
// and always the personal Claude Code files. Idempotent.
export function buildGitignore(existing: string): string {
    const base = existing.trim() === '' ? DEFAULT_GITIGNORE : existing;
    return withClaudeIgnores(appendMissing(base, REQUIRED_IGNORES, 'Added by create-nestkit'));
}
