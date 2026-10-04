import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { loadManifest, resolvePlugins, pinDep, generateProject, writeClaudeTooling, Manifest } from './generator';
import { NEST } from './nest-version';

const PLUGINS_DIR = path.join(__dirname, '..', 'templates', 'plugins');
const ALL_PLUGIN_IDS = fs.readdirSync(PLUGINS_DIR);

describe('loadManifest', () => {
    it('loads every plugin manifest as valid JSON matching the Manifest shape', () => {
        for (const id of ALL_PLUGIN_IDS) {
            const manifest = loadManifest(id);
            expect(manifest.id).toBe(id);
            expect(Array.isArray(manifest.requires)).toBe(true);
            expect(Array.isArray(manifest.appModule.imports)).toBe(true);
            expect(Array.isArray(manifest.appModule.modules)).toBe(true);
            expect(Array.isArray(manifest.dependencies.prod)).toBe(true);
            expect(Array.isArray(manifest.dependencies.dev)).toBe(true);
        }
    });

    it('every manifest-declared relative appModule import ends in .js (ESM-safe)', () => {
        for (const id of ALL_PLUGIN_IDS) {
            for (const line of loadManifest(id).appModule.imports) {
                const match = line.match(/from\s+'(\.[^']+)'/);
                if (match) expect(match[1]).toMatch(/\.js$/);
            }
        }
    });

    it('every id a manifest declares in "requires" actually exists as a plugin', () => {
        for (const id of ALL_PLUGIN_IDS) {
            for (const dep of loadManifest(id).requires) {
                expect(ALL_PLUGIN_IDS).toContain(dep);
            }
        }
    });

});

describe('generateProject — input guards', () => {
    const base = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nestkit-input-'));

    it('rejects a project name that would reach the shell, before doing any work', async () => {
        const dir = base();
        const marker = path.join(dir, 'pwned');

        await expect(generateProject({
            projectName: `x; touch ${marker}`,
            plugins:     [],
            dbDriver:    'postgres',
            targetDir:   path.join(dir, 'x'),
        })).rejects.toThrow(/letters, numbers/);

        expect(fs.existsSync(marker)).toBe(false);
    });

    it('rejects when the target directory already exists, leaving it untouched', async () => {
        const targetDir = base();
        fs.writeFileSync(path.join(targetDir, 'keep.txt'), 'mine');

        await expect(generateProject({
            projectName: 'my-api',
            plugins:     [],
            dbDriver:    'postgres',
            targetDir,
        })).rejects.toThrow(/already exists/);

        expect(fs.readFileSync(path.join(targetDir, 'keep.txt'), 'utf-8')).toBe('mine');
    });
});

describe('manifest allowScripts', () => {
    it('is a list of package names where declared, and the pdf plugin declares puppeteer (Chrome download)', () => {
        for (const id of ['database', 'auth', 'mailer', 'socket', 'pdf', 'observe', 'users', 'roles']) {
            const { allowScripts } = loadManifest(id);
            if (allowScripts !== undefined) expect(allowScripts.every(n => typeof n === 'string' && n.length > 0)).toBe(true);
        }
        expect(loadManifest('pdf').allowScripts).toContain('puppeteer');
    });
});

describe('resolvePlugins', () => {
    it('returns an empty array when nothing is selected', () => {
        expect(resolvePlugins([])).toEqual([]);
    });

    it('leaves a dependency-free plugin as-is', () => {
        expect(resolvePlugins(['mailer'])).toEqual(['mailer']);
    });

    it('resolves auth to its full transitive chain in dependency order', () => {
        // auth requires [database, users, roles] — each must appear before its dependent,
        // and before anything that depends on it.
        expect(resolvePlugins(['auth'])).toEqual(['database', 'users', 'roles', 'auth']);
    });

    it('does not duplicate a plugin pulled in both directly and transitively', () => {
        const resolved = resolvePlugins(['database', 'auth']);
        expect(resolved.filter(id => id === 'database')).toHaveLength(1);
        expect(resolved).toEqual(['database', 'users', 'roles', 'auth']);
    });

    it('combines independent plugin selections without cross-contamination', () => {
        const resolved = resolvePlugins(['socket', 'pdf']);
        expect(resolved).toEqual(['socket', 'pdf']);
    });
});

describe('pinDep', () => {
    it('pins a tightly-coupled @nestjs/* package to the target Nest major', () => {
        expect(pinDep('@nestjs/swagger')).toBe(`@nestjs/swagger@^${NEST.major}`);
        expect(pinDep('@nestjs/typeorm')).toBe(`@nestjs/typeorm@^${NEST.major}`);
    });

    it('leaves an unlisted package name bare so npm resolves it to latest', () => {
        expect(pinDep('typeorm')).toBe('typeorm');
        expect(pinDep('bcrypt')).toBe('bcrypt');
    });
});

describe('writeClaudeTooling — full .claude/ output of a generated project', () => {
    const generate = (selected: string[]) => {
        const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nestkit-claude-'));
        fs.writeFileSync(path.join(targetDir, '.gitignore'), '/dist\n/node_modules\n');   // what `nest new` leaves
        const manifests = resolvePlugins(selected).map(loadManifest);
        writeClaudeTooling(targetDir, manifests, 'postgres', 'demo-api');
        const at = (rel: string) => path.join(targetDir, rel);
        return { targetDir, at, exists: (rel: string) => fs.existsSync(at(rel)) };
    };

    it('writes docs, settings, hooks, skills, subagents and gitignore entries', () => {
        const p = generate([]);
        for (const rel of [
            '.claude/CLAUDE.md', '.claude/settings.json', '.claude/rules/api-patterns.md',
            '.claude/hooks/protect-files.cjs', '.claude/hooks/format.cjs',
            '.claude/agents/code-reviewer.md', '.claude/agents/test-runner.md',
            '.claude/skills/nest-exception/SKILL.md', '.claude/skills/nest-plugin/SKILL.md',
            '.claude/context/decisions.md',
        ]) {
            expect(p.exists(rel), rel).toBe(true);
        }
        expect(JSON.parse(fs.readFileSync(p.at('.claude/settings.json'), 'utf-8')).permissions.deny).toContain('Read(./.env)');

        const gitignore = fs.readFileSync(p.at('.gitignore'), 'utf-8');
        expect(gitignore.startsWith('/dist\n/node_modules\n')).toBe(true);
        expect(gitignore).toContain('.claude/settings.local.json');
    });

    it('ships the database-only skills only with the Database plugin', () => {
        expect(generate([]).exists('.claude/skills/nest-module')).toBe(false);
        expect(generate([]).exists('.claude/skills/db-map')).toBe(false);
        expect(generate(['database']).exists('.claude/skills/nest-module/SKILL.md')).toBe(true);
        expect(generate(['database']).exists('.claude/skills/db-map/SKILL.md')).toBe(true);
        expect(generate(['auth']).exists('.claude/skills/nest-module/SKILL.md')).toBe(true);   // auth pulls in database
    });

    it('every skill, subagent and hook referenced by CLAUDE.md and settings.json exists in the output', () => {
        const p = generate(['database', 'auth', 'mailer']);
        const claudeMd = fs.readFileSync(p.at('.claude/CLAUDE.md'), 'utf-8');

        for (const skill of new Set(claudeMd.match(/`\/([a-z-]+)(?: <[^`]*)?`/g)?.map(m => /\/([a-z-]+)/.exec(m)![1]) ?? [])) {
            expect(p.exists(`.claude/skills/${skill}/SKILL.md`), `skill /${skill}`).toBe(true);
        }
        for (const agent of ['code-reviewer', 'test-runner']) {
            expect(claudeMd).toContain(agent);
            expect(p.exists(`.claude/agents/${agent}.md`)).toBe(true);
        }

        const settings = fs.readFileSync(p.at('.claude/settings.json'), 'utf-8');
        for (const script of new Set(settings.match(/hooks\/[\w.-]+\.cjs/g) ?? [])) {
            expect(p.exists(`.claude/${script}`), script).toBe(true);
        }
    });
});
