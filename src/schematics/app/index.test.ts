import { createRequire } from 'module';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { SchematicTestRunner, UnitTestTree } from '@angular-devkit/schematics/testing';

// The engine loads the factory with require(); ts-node lets it load index.ts from src/ without a build first.
createRequire(__filename)('ts-node/register/transpile-only');

const runner = new SchematicTestRunner('create-nestkit', path.join(__dirname, '..', 'collection.json'));

const generate = (options: Record<string, unknown>): Promise<UnitTestTree> => runner.runSchematic('app', { name: 'demo', ...options });
const read     = (tree: UnitTestTree, rel: string): string => tree.readContent(`/demo/${rel}`);

describe('app schematic', () => {
    it('builds a bare project from Nest\'s own files plus ours, in memory', async () => {
        const tree = await generate({});

        expect(tree.exists('/demo/nest-cli.json')).toBe(true);
        expect(tree.exists('/demo/.gitignore')).toBe(true);
        expect(tree.exists('/demo/src/app.controller.ts')).toBe(false);
        expect(read(tree, 'src/main.ts')).toContain('enableShutdownHooks');
        expect(JSON.parse(read(tree, 'package.json')).scripts.typecheck).toBe('tsc --noEmit');
    });

    it('uses the test runner of the module system it was asked for', async () => {
        const esm = JSON.parse(read(await generate({ type: 'esm' }), 'tsconfig.json'));
        const cjs = JSON.parse(read(await generate({ type: 'cjs' }), 'tsconfig.json'));

        expect(esm.compilerOptions.types).toEqual(['vitest/globals', 'node']);
        expect(cjs.compilerOptions.types).toEqual(['node', 'jest']);
    });

    it('adds the plugins, their dependencies and their files', async () => {
        const tree = await generate({ plugins: ['auth'], passwordHasher: 'argon2' });

        expect(tree.exists('/demo/src/database/seeds/seed.ts')).toBe(true);
        expect(read(tree, 'src/shared/security/password.util.ts')).toContain('argon2');
        expect(read(tree, 'src/app.module.ts')).toContain('AuthModule');
        expect(read(tree, '.env.example')).toContain('JWT_');
    });

    it('seeds nothing when the Database plugin has no Users', async () => {
        const tree = await generate({ plugins: ['database'] });

        expect(read(tree, 'src/database/seeds/seed.ts')).toContain('// Add seeders here.');
    });

    it('copies the database skills only with the Database plugin', async () => {
        expect((await generate({})).exists('/demo/.claude/skills/nest-module/SKILL.md')).toBe(false);
        expect((await generate({ plugins: ['database'] })).exists('/demo/.claude/skills/nest-module/SKILL.md')).toBe(true);
    });

    it('registers the mailer templates as nest-cli assets', async () => {
        const cli = JSON.parse(read(await generate({ plugins: ['mailer'] }), 'nest-cli.json'));

        expect(cli.compilerOptions.assets.length).toBeGreaterThan(0);
    });

    describe('the Mailer plugin', () => {
        it('with Auth, binds the real AuthMailer and ships its mail classes and templates', async () => {
            const tree = await generate({ plugins: ['auth', 'mailer'] });

            expect(read(tree, 'src/app/auth/auth-mailer.provider.ts')).toContain('MailAuthMailer');
            for (const rel of [
                'src/app/auth/services/mail-auth-mailer.service.ts', 'src/app/auth/mails/verify-email.mail.ts', 'src/app/auth/mails/reset-password.mail.ts',
                'src/plugins/mailer/templates/auth/verify-email.html', 'src/plugins/mailer/templates/auth/reset-password.txt',
            ]) {
                expect(tree.exists(`/demo/${rel}`), rel).toBe(true);
            }
        });

        it('with Auth but without Mailer, keeps the simulated AuthMailer and none of the mail files', async () => {
            const tree = await generate({ plugins: ['auth'] });

            expect(read(tree, 'src/app/auth/auth-mailer.provider.ts')).toContain('SimulatedAuthMailer');
            expect(tree.exists('/demo/src/app/auth/services/mail-auth-mailer.service.ts')).toBe(false);
        });

        it('does not need Auth: no auth files when only the Mailer is selected', async () => {
            const tree = await generate({ plugins: ['mailer'] });

            expect(tree.exists('/demo/src/app/auth')).toBe(false);
            expect(tree.exists('/demo/src/plugins/mailer/mailer.module.ts')).toBe(true);
        });

        it('ships its specs only in ESM projects (they use vitest)', async () => {
            expect((await generate({ plugins: ['mailer'], type: 'esm' })).exists('/demo/src/plugins/mailer/tests/transports.spec.ts')).toBe(true);
            expect((await generate({ plugins: ['mailer'], type: 'cjs' })).exists('/demo/src/plugins/mailer/tests/transports.spec.ts')).toBe(false);
        });

        it('git-ignores what the file transport writes', async () => {
            expect(read(await generate({ plugins: ['mailer'] }), '.gitignore')).toMatch(/^\/var$/m);
            expect(read(await generate({}), '.gitignore')).not.toMatch(/^\/var$/m);
        });
    });
});
