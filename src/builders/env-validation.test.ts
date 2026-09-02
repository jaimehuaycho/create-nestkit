import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import { buildEnvValidation } from './env-validation';

describe('buildEnvValidation', () => {
    let tmpDir: string;

    afterEach(() => {
        if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function setup() {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-validation-'));
        const templatePath = path.join(tmpDir, 'env.validation.ts');
        fs.writeFileSync(templatePath, [
            `export const envValidation = Joi.object({`,
            `    // {{PLUGIN_ENV_VARS}}`,
            `});`,
        ].join('\n'));

        const pluginsDir = path.join(tmpDir, 'plugins');
        fs.mkdirSync(path.join(pluginsDir, 'auth'), { recursive: true });
        fs.writeFileSync(path.join(pluginsDir, 'auth', '_env.fragment'), `    JWT_SECRET: Joi.string().required(),\n`);

        return { templatePath, templatesDir: tmpDir };
    }

    it('appends the env fragment of each active plugin that has one', () => {
        const { templatePath, templatesDir } = setup();
        const result = buildEnvValidation(templatePath, ['auth'], templatesDir);
        expect(result).toContain('JWT_SECRET: Joi.string().required(),');
        expect(result).not.toContain('{{PLUGIN_ENV_VARS}}');
    });

    it('silently skips a plugin with no _env.fragment file', () => {
        const { templatePath, templatesDir } = setup();
        const result = buildEnvValidation(templatePath, ['auth', 'pdf'], templatesDir);
        expect(result).toContain('JWT_SECRET');
    });

    it('produces just the bare template when no plugins are active', () => {
        const { templatePath, templatesDir } = setup();
        const result = buildEnvValidation(templatePath, [], templatesDir);
        expect(result).not.toContain('{{PLUGIN_ENV_VARS}}');
        expect(result).not.toContain('JWT_SECRET');
    });
});
