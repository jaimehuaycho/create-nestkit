import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import { addNestAssets } from './nest-cli';
import { loadManifest, Manifest } from '../generator';

const fake = (nestAssets?: string[]): Manifest => ({
    id: 'fake', requires: [], appModule: { imports: [], modules: [] },
    dependencies: { prod: [], dev: [] }, scripts: {}, nestAssets,
});

describe('addNestAssets', () => {
    let dir: string;
    const write = (cli: object) => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nest-cli-'));
        fs.writeFileSync(path.join(dir, 'nest-cli.json'), JSON.stringify(cli));
    };
    const read = () => JSON.parse(fs.readFileSync(path.join(dir, 'nest-cli.json'), 'utf-8'));

    afterEach(() => { if (dir) fs.rmSync(dir, { recursive: true, force: true }); });

    it('adds the plugin globs as assets and keeps the rest of nest-cli.json', () => {
        write({ collection: '@nestjs/schematics', sourceRoot: 'src', compilerOptions: { deleteOutDir: true } });
        addNestAssets(dir, [fake(['plugins/mailer/templates/**/*.hbs'])]);
        expect(read().compilerOptions).toEqual({
            deleteOutDir: true,
            assets: [{ include: 'plugins/mailer/templates/**/*.hbs', watchAssets: true }],
        });
        expect(read().sourceRoot).toBe('src');
    });

    it('does nothing when no plugin declares assets (the file is left untouched)', () => {
        write({ sourceRoot: 'src' });
        const before = fs.readFileSync(path.join(dir, 'nest-cli.json'), 'utf-8');
        addNestAssets(dir, [fake(undefined), fake([])]);
        expect(fs.readFileSync(path.join(dir, 'nest-cli.json'), 'utf-8')).toBe(before);
    });

    it('creates compilerOptions when missing and never duplicates or drops existing assets', () => {
        write({ sourceRoot: 'src' });
        addNestAssets(dir, [fake(['a/**/*.hbs'])]);
        addNestAssets(dir, [fake(['a/**/*.hbs'])]);
        expect(read().compilerOptions.assets).toHaveLength(1);

        write({ compilerOptions: { assets: ['**/*.graphql'] } });
        addNestAssets(dir, [fake(['a/**/*.hbs'])]);
        expect(read().compilerOptions.assets).toEqual(['**/*.graphql', { include: 'a/**/*.hbs', watchAssets: true }]);
    });

    it('the mailer plugin declares its templates folder, matching where the SMTP module reads them', () => {
        expect(loadManifest('mailer').nestAssets).toEqual(['plugins/mailer/templates/**/*.hbs']);
        const smtp = fs.readFileSync(path.join(__dirname, '..', '..', 'templates', 'plugins', 'mailer', 'src', 'plugins', 'mailer', 'smtp', 'smtp.module.ts'), 'utf-8');
        expect(smtp).toContain("join(process.cwd(), 'dist', 'plugins', 'mailer', 'templates')");
    });
});
