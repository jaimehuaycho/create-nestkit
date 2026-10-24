import { createRequire } from 'module';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';

createRequire(__filename)('ts-node/register/transpile-only');

const runner = new SchematicTestRunner('create-nestkit', path.join(__dirname, '..', 'collection.json'));

// Everything Claude Code reads from a generated project: docs built per selection, enforced settings, static tooling, gitignore entries.
describe('the .claude/ of a generated project', () => {
    const generate = async (plugins: string[]) => {
        const tree = await runner.runSchematic('app', { name: 'demo-api', plugins });
        return { read: (rel: string) => tree.readContent(`/demo-api/${rel}`), exists: (rel: string) => tree.exists(`/demo-api/${rel}`) };
    };

    it('writes docs, settings, hooks, skills, subagents and gitignore entries', async () => {
        const p = await generate([]);
        for (const rel of [
            '.claude/CLAUDE.md', '.claude/settings.json', '.claude/rules/api-patterns.md',
            '.claude/hooks/protect-files.cjs', '.claude/hooks/format.cjs',
            '.claude/agents/code-reviewer.md', '.claude/agents/test-runner.md',
            '.claude/skills/nest-exception/SKILL.md', '.claude/skills/nest-plugin/SKILL.md',
            '.claude/context/decisions.md',
        ]) {
            expect(p.exists(rel), rel).toBe(true);
        }
        expect(JSON.parse(p.read('.claude/settings.json')).permissions.deny).toContain('Read(./.env)');

        const gitignore = p.read('.gitignore');
        expect(gitignore).toContain('/node_modules');
        expect(gitignore).toContain('.claude/settings.local.json');
    });

    it('ships the database-only skills only with the Database plugin', async () => {
        const bare = await generate([]);
        const db   = await generate(['database']);
        expect(bare.exists('.claude/skills/nest-module/SKILL.md')).toBe(false);
        expect(bare.exists('.claude/skills/db-map/SKILL.md')).toBe(false);
        expect(db.exists('.claude/skills/nest-module/SKILL.md')).toBe(true);
        expect(db.exists('.claude/skills/db-map/SKILL.md')).toBe(true);
        expect((await generate(['auth'])).exists('.claude/skills/nest-module/SKILL.md')).toBe(true);   // auth pulls in database
    });

    it('every skill, subagent and hook referenced by CLAUDE.md and settings.json exists in the output', async () => {
        const p = await generate(['database', 'auth', 'mailer']);
        const claudeMd = p.read('.claude/CLAUDE.md');

        for (const skill of new Set(claudeMd.match(/`\/([a-z-]+)(?: <[^`]*)?`/g)?.map(m => /\/([a-z-]+)/.exec(m)![1]) ?? [])) {
            expect(p.exists(`.claude/skills/${skill}/SKILL.md`), `skill /${skill}`).toBe(true);
        }
        for (const agent of ['code-reviewer', 'test-runner']) {
            expect(claudeMd).toContain(agent);
            expect(p.exists(`.claude/agents/${agent}.md`)).toBe(true);
        }

        for (const script of new Set(p.read('.claude/settings.json').match(/hooks\/[\w.-]+\.cjs/g) ?? [])) {
            expect(p.exists(`.claude/${script}`), script).toBe(true);
        }
    });
});
