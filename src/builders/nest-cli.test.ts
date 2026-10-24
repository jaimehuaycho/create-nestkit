import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { applyNestAssets } from './nest-cli';
import { loadManifest, Manifest } from '../generator';

const fake = (nestAssets?: string[]): Manifest => ({
    id: 'fake', requires: [], appModule: { imports: [], modules: [] },
    dependencies: { prod: [], dev: [] }, scripts: {}, nestAssets,
});

describe('applyNestAssets', () => {
    it('adds the plugin globs as assets and keeps the rest of nest-cli.json', () => {
        const cli = { collection: '@nestjs/schematics', sourceRoot: 'src', compilerOptions: { deleteOutDir: true } };
        expect(applyNestAssets(cli, [fake(['plugins/mailer/templates/**/*.hbs'])])).toBe(true);
        expect(cli.compilerOptions).toEqual({
            deleteOutDir: true,
            assets: [{ include: 'plugins/mailer/templates/**/*.hbs', watchAssets: true }],
        });
        expect(cli.sourceRoot).toBe('src');
    });

    it('does nothing when no plugin declares assets (the file is left untouched)', () => {
        const cli = { sourceRoot: 'src' };
        expect(applyNestAssets(cli, [fake(undefined), fake([])])).toBe(false);
        expect(cli).toEqual({ sourceRoot: 'src' });
    });

    it('creates compilerOptions when missing and never duplicates or drops existing assets', () => {
        const cli: any = { sourceRoot: 'src' };
        applyNestAssets(cli, [fake(['a/**/*.hbs'])]);
        applyNestAssets(cli, [fake(['a/**/*.hbs'])]);
        expect(cli.compilerOptions.assets).toHaveLength(1);

        const withGraphql: any = { compilerOptions: { assets: ['**/*.graphql'] } };
        applyNestAssets(withGraphql, [fake(['a/**/*.hbs'])]);
        expect(withGraphql.compilerOptions.assets).toEqual(['**/*.graphql', { include: 'a/**/*.hbs', watchAssets: true }]);
    });

    it('the mailer plugin declares its templates folder, matching where the SMTP module reads them', () => {
        expect(loadManifest('mailer').nestAssets).toEqual(['plugins/mailer/templates/**/*.hbs']);
        const smtp = fs.readFileSync(path.join(__dirname, '..', '..', 'templates', 'plugins', 'mailer', 'src', 'plugins', 'mailer', 'smtp', 'smtp.module.ts'), 'utf-8');
        expect(smtp).toContain("join(process.cwd(), 'dist', 'plugins', 'mailer', 'templates')");
    });
});
