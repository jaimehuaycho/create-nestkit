import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { buildSettings, buildSettingsJson } from './settings-json';
import { loadManifest, resolvePlugins } from '../generator';

const manifestsFor = (selected: string[]) => resolvePlugins(selected).map(loadManifest);
const HOOKS_DIR = path.join(__dirname, '..', '..', 'templates', 'core', '.claude', 'hooks');

describe('buildSettings', () => {
    it('emits valid JSON', () => {
        expect(() => JSON.parse(buildSettingsJson(manifestsFor(['auth', 'mailer'])))).not.toThrow();
    });

    it('denies reading real env files but not .env.example', () => {
        const { deny } = buildSettings(manifestsFor([])).permissions;
        expect(deny).toContain('Read(./.env)');
        expect(deny).toContain('Read(./.env.production)');
        expect(deny.some(rule => rule.includes('.env.example'))).toBe(false);
    });

    it('lets Claude run the verification commands without asking', () => {
        const { allow } = buildSettings(manifestsFor([])).permissions;
        for (const cmd of ['npm test', 'npm run typecheck', 'npm run lint', 'npm run build']) {
            expect(allow).toContain(`Bash(${cmd} *)`);
        }
    });

    it('asks before DB-mutating scripts only when the Database plugin is active', () => {
        const withDb = buildSettings(manifestsFor(['database'])).permissions.ask;
        const without = buildSettings(manifestsFor([])).permissions.ask;
        expect(withDb).toContain('Bash(npm run migration:run *)');
        expect(withDb).toContain('Bash(npm run seed *)');
        expect(without.some(rule => rule.includes('migration') || rule.includes('seed'))).toBe(false);
    });

    it('always asks before pushing', () => {
        expect(buildSettings(manifestsFor([])).permissions.ask).toContain('Bash(git push *)');
    });

    it('never allows and denies the same rule (a deny always wins, so it would be dead config)', () => {
        const { allow, deny } = buildSettings(manifestsFor(['database', 'auth'])).permissions;
        expect(allow.filter(rule => deny.includes(rule))).toEqual([]);
    });

    it('wires hooks to scripts that exist in the template', () => {
        const { hooks } = buildSettings(manifestsFor([]));
        const commands = Object.values(hooks).flatMap(groups => groups.flatMap(g => g.hooks.map(h => h.command)));
        expect(commands.length).toBeGreaterThan(0);

        for (const command of commands) {
            const script = /\/hooks\/([\w.-]+\.cjs)"?$/.exec(command)?.[1];
            expect(script, command).toBeDefined();
            expect(fs.existsSync(path.join(HOOKS_DIR, script!)), `${script} missing in templates`).toBe(true);
        }
    });
});
