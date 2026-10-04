import { describe, it, expect } from 'vitest';
import { buildAllClaudeFiles } from './claude-md';
import { loadManifest, resolvePlugins } from '../generator';

const SELECTABLE = ['database', 'auth', 'mailer', 'socket', 'pdf', 'observe'];

// Every combination of user-selectable plugins (auth pulls in database, users and roles).
const COMBINATIONS: string[][] = Array.from({ length: 1 << SELECTABLE.length }, (_, mask) =>
    SELECTABLE.filter((_, i) => mask & (1 << i)),
);

function generate(selected: string[]): Map<string, string> {
    const manifests = resolvePlugins(selected).map(loadManifest);
    return buildAllClaudeFiles(manifests, 'postgres', 'demo-api');
}

const label = (selected: string[]) => selected.length ? selected.join('+') : 'no plugins';

describe('generated .claude docs: integrity across every plugin combination', () => {
    it.each(COMBINATIONS.map(c => [label(c), c] as const))('%s', (_name, selected) => {
        const files = generate(selected);
        const claudeMd = files.get('.claude/CLAUDE.md')!;
        const all = [...files.values()].join('\n');
        const hasDb = resolvePlugins(selected).includes('database');

        // Lean root: it is loaded in full on every request.
        expect(claudeMd.split('\n').length).toBeLessThanOrEqual(100);

        // Imports load at launch like inline text; the root must not pull rules in with @.
        expect(claudeMd).not.toMatch(/^@\.claude\//m);

        // Every rule is scoped, so it only loads when its area is touched.
        const rules = [...files.entries()].filter(([p]) => p.startsWith('.claude/rules/'));
        expect(rules.length).toBeGreaterThan(0);
        for (const [rulePath, content] of rules) {
            expect(content, rulePath).toMatch(/^---\npaths:\n( {2}- ".+"\n)+---\n/);
        }

        // Rule docs moved out of src/*/CLAUDE.md; nothing may still point there.
        expect(all).not.toMatch(/src\/[\w/]*CLAUDE\.md/);

        // Real templates use relative `.js` imports; the `src/...` alias fails typecheck on ESM, so never teach it.
        expect(all).not.toMatch(/from 'src\//);

        // Every rule file mentioned anywhere must actually be generated.
        for (const ref of new Set(all.match(/\.claude\/rules\/[\w-]+\.md/g) ?? [])) {
            expect(files.has(ref), `${ref} is referenced but not generated`).toBe(true);
        }

        // Database-only skills must not be advertised when the Database plugin is absent.
        if (!hasDb) {
            expect(all).not.toContain('/nest-module');
            expect(all).not.toContain('/db-map');
            expect(all).not.toContain('database.md');
        }

        // Plugin docs only appear with their plugin.
        expect(files.has('.claude/rules/auth.md')).toBe(selected.includes('auth'));
        expect(files.has('.claude/rules/database.md')).toBe(hasDb);
    });
});

describe('generated auth docs follow the chosen password hasher', () => {
    const gen = (hasher: 'bcrypt' | 'argon2') =>
        buildAllClaudeFiles(resolvePlugins(['auth']).map(loadManifest), 'postgres', 'demo-api', hasher);

    it('bcrypt: names it, with the 72-byte limit', () => {
        const auth = gen('bcrypt').get('.claude/rules/auth.md')!;
        expect(auth).toContain('## Password hashing (bcrypt)');
        expect(auth).toMatch(/72 BYTES/);
        expect(gen('bcrypt').get('.claude/rules/shared.md')).toMatch(/password\.util\.ts.*bcrypt, max 72 bytes/);
    });

    it('argon2: names Argon2id and says there is no truncation', () => {
        const auth = gen('argon2').get('.claude/rules/auth.md')!;
        expect(auth).toContain('## Password hashing (Argon2id)');
        expect(auth).toMatch(/No truncation/);
        expect(auth).not.toMatch(/72 BYTES/);
        expect(gen('argon2').get('.claude/rules/shared.md')).toMatch(/Argon2id, max 256 bytes/);
    });

    it('never points at the old core crypto.util', () => {
        for (const h of ['bcrypt', 'argon2'] as const) {
            expect([...gen(h).values()].join('\n')).not.toContain('crypto.util');
        }
    });

    it('defaults to bcrypt when no choice is passed', () => {
        const files = buildAllClaudeFiles(resolvePlugins(['auth']).map(loadManifest), 'postgres', 'demo-api');
        expect(files.get('.claude/rules/auth.md')).toContain('(bcrypt)');
    });
});

describe('generated CLAUDE.md content', () => {
    it('tells Claude how to verify its work', () => {
        const md = generate([]).get('.claude/CLAUDE.md')!;
        for (const cmd of ['npm run typecheck', 'npm run lint', 'npm test', 'npm run build']) {
            expect(md).toContain(cmd);
        }
    });

    it('describes the seed according to what it really does', () => {
        expect(generate(['auth']).get('.claude/CLAUDE.md')).toMatch(/seed .*role hierarchy/);
        expect(generate(['database']).get('.claude/CLAUDE.md')).toMatch(/seed .*empty seed script/);
    });

    it('tells Claude to read a rule before planning in an area, since rules only load on file access', () => {
        expect(generate([]).get('.claude/CLAUDE.md')).toMatch(/read its rule file first/);
    });

    it('says no migrations ship and that none run automatically', () => {
        expect(generate(['database']).get('.claude/CLAUDE.md')).toMatch(/none shipped/);
    });

    it('keeps the decision journal and plans folder', () => {
        const files = generate([]);
        expect(files.has('.claude/context/decisions.md')).toBe(true);
        expect(files.has('.claude/context/plans/README.md')).toBe(true);
    });
});
