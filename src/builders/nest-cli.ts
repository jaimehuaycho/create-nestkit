import * as fs   from 'fs';
import * as path from 'path';
import { Manifest } from '../generator';

// `nest build` only compiles TypeScript: any other file (Handlebars templates, GraphQL schemas...) is NOT copied into
// dist/ unless `compilerOptions.assets` in nest-cli.json says so (official Nest CLI docs: assets must live under src/,
// patterns are relative to it). Each plugin declares the globs it needs in its manifest (`nestAssets`), so e.g. the
// mailer's `.hbs` templates exist at dist/plugins/mailer/templates, where its SMTP module reads them.
export function addNestAssets(targetDir: string, manifests: Manifest[]): void {
    const includes = manifests.flatMap(m => m.nestAssets ?? []);
    if (includes.length === 0) return;

    const cliPath = path.join(targetDir, 'nest-cli.json');
    const cli     = JSON.parse(fs.readFileSync(cliPath, 'utf-8'));

    cli.compilerOptions ??= {};
    const assets: unknown[] = cli.compilerOptions.assets ?? [];
    const known = new Set(assets.map(a => (typeof a === 'string' ? a : (a as { include?: string }).include)));

    for (const include of includes) {
        if (!known.has(include)) assets.push({ include, watchAssets: true });
    }

    cli.compilerOptions.assets = assets;
    fs.writeFileSync(cliPath, JSON.stringify(cli, null, 2) + '\n');
}
