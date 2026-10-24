import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { describe, it, expect } from 'vitest';

// Tests for the static Claude Code tooling in templates/core/.claude: hooks, skills and subagents.
const CLAUDE_DIR = path.join(__dirname, '..', 'templates', 'core', '.claude');

// Parses the simple `key: value` YAML frontmatter these files use.
function frontmatter(file: string): Record<string, string> {
    const match = /^---\n([\s\S]*?)\n---\n/.exec(fs.readFileSync(file, 'utf-8'));
    if (!match) throw new Error(`${file} has no frontmatter`);
    return Object.fromEntries(
        match[1].split('\n').map(line => {
            const i = line.indexOf(':');
            return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
        }),
    );
}

function runHook(script: string, event: unknown, projectDir: string) {
    return spawnSync('node', [path.join(CLAUDE_DIR, 'hooks', script)], {
        input: typeof event === 'string' ? event : JSON.stringify(event),
        env:   { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
        encoding: 'utf-8',
    });
}

const edit  = (file_path: string) => ({ tool_name: 'Edit',  tool_input: { file_path } });
const write = (file_path: string) => ({ tool_name: 'Write', tool_input: { file_path } });

describe('protect-files.cjs hook', () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'nestkit-hook-'));
    fs.mkdirSync(path.join(project, 'src/database/migrations'), { recursive: true });
    fs.writeFileSync(path.join(project, 'src/database/migrations/1700000000000-Init.ts'), '// applied');

    it.each([
        '.env', '.env.local', '.env.production', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.git/config',
    ])('blocks (exit 2) %s and explains why on stderr', (file) => {
        const result = runHook('protect-files.cjs', edit(file), project);
        expect(result.status).toBe(2);
        expect(result.stderr).toMatch(/Blocked/);
    });

    it('blocks an absolute path to a protected file too', () => {
        expect(runHook('protect-files.cjs', edit(path.join(project, '.env')), project).status).toBe(2);
    });

    it('allows normal source files, .env.example and unrelated files', () => {
        for (const file of ['src/app.module.ts', '.env.example', 'README.md', 'src/environment.ts']) {
            expect(runHook('protect-files.cjs', edit(file), project).status, file).toBe(0);
        }
    });

    it('blocks editing or overwriting an existing migration, but allows creating a new one', () => {
        const existing = 'src/database/migrations/1700000000000-Init.ts';
        expect(runHook('protect-files.cjs', edit(existing), project).status).toBe(2);
        expect(runHook('protect-files.cjs', write(existing), project).status).toBe(2);
        expect(runHook('protect-files.cjs', write('src/database/migrations/1800000000000-AddUsers.ts'), project).status).toBe(0);
    });

    it('never breaks the session on malformed or empty input', () => {
        expect(runHook('protect-files.cjs', 'not json', project).status).toBe(0);
        expect(runHook('protect-files.cjs', {}, project).status).toBe(0);
        expect(runHook('protect-files.cjs', { tool_input: {} }, project).status).toBe(0);
    });
});

describe('format.cjs hook', () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'nestkit-format-'));

    it('exits 0 and leaves non-formattable files alone', () => {
        const file = path.join(project, 'notes.md');
        fs.writeFileSync(file, '#   untouched   ');
        expect(runHook('format.cjs', edit(file), project).status).toBe(0);
        expect(fs.readFileSync(file, 'utf-8')).toBe('#   untouched   ');
    });

    it('exits 0 when the file is gone, outside the project, or prettier is not installed', () => {
        expect(runHook('format.cjs', edit(path.join(project, 'missing.ts')), project).status).toBe(0);
        expect(runHook('format.cjs', edit('/etc/hosts'), project).status).toBe(0);

        const file = path.join(project, 'a.ts');
        fs.writeFileSync(file, 'const   a  =  1');
        expect(runHook('format.cjs', edit(file), project).status).toBe(0);   // no prettier here: best effort
    }, 30_000);   // the hook really runs `npx --no-install prettier` (its own timeout is 20 s): slow when the machine is busy

    it('never breaks the session on malformed input', () => {
        expect(runHook('format.cjs', 'not json', project).status).toBe(0);
        expect(runHook('format.cjs', {}, project).status).toBe(0);
    });
});

describe('skills', () => {
    const skillFiles = ['skills', 'skills-db'].flatMap(group =>
        fs.readdirSync(path.join(CLAUDE_DIR, group)).map(name => path.join(CLAUDE_DIR, group, name, 'SKILL.md')),
    );

    it('ships the expected skills', () => {
        expect(skillFiles.map(f => path.basename(path.dirname(f))).sort())
            .toEqual(['db-map', 'nest-exception', 'nest-module', 'nest-plugin']);
    });

    it.each(skillFiles.map(f => [path.basename(path.dirname(f)), f] as const))('%s has valid frontmatter', (name, file) => {
        const fm = frontmatter(file);
        expect(fm.name).toBe(name);
        expect(fm.description.length).toBeGreaterThan(20);
        expect(fm['disable-model-invocation']).toBe('true');     // they scaffold files: user-invoked only
        expect(fm['argument-hint']).toBeDefined();
    });

    it('no skill points at the old command names or at a CLAUDE.md that no longer holds the patterns', () => {
        for (const file of skillFiles) {
            const text = fs.readFileSync(file, 'utf-8');
            expect(text, file).not.toMatch(/\/nestjs\/|\/db\/map/);
            expect(text, file).not.toMatch(/pattern from CLAUDE\.md/);
        }
    });
});

describe('subagents', () => {
    const agentFiles = fs.readdirSync(path.join(CLAUDE_DIR, 'agents')).map(f => path.join(CLAUDE_DIR, 'agents', f));

    it.each(agentFiles.map(f => [path.basename(f, '.md'), f] as const))('%s has valid frontmatter', (name, file) => {
        const fm = frontmatter(file);
        expect(fm.name).toBe(name);
        expect(fm.description.length).toBeGreaterThan(20);
        expect(fm.tools).toBeDefined();
    });

    it('the reviewer cannot edit files', () => {
        const tools = frontmatter(path.join(CLAUDE_DIR, 'agents', 'code-reviewer.md')).tools;
        expect(tools).not.toMatch(/Edit|Write/);
    });
});
