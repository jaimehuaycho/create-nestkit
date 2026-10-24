import { Manifest } from '../generator';

// `nest build` only compiles TypeScript: any other file (Handlebars templates, GraphQL schemas...) is NOT copied into
// dist/ unless `compilerOptions.assets` in nest-cli.json says so (official Nest CLI docs: assets must live under src/,
// patterns are relative to it). Each plugin declares the globs it needs in its manifest (`nestAssets`), so e.g. the
// mailer's `.hbs` templates exist at dist/plugins/mailer/templates, where its SMTP module reads them.
// Returns false when no plugin declares assets (nothing to change).
export function applyNestAssets(cli: any, manifests: Manifest[]): boolean {
    const includes = manifests.flatMap(m => m.nestAssets ?? []);
    if (includes.length === 0) return false;

    cli.compilerOptions ??= {};
    const assets: unknown[] = cli.compilerOptions.assets ?? [];
    const known = new Set(assets.map(a => (typeof a === 'string' ? a : (a as { include?: string }).include)));

    for (const include of includes) {
        if (!known.has(include)) assets.push({ include, watchAssets: true });
    }

    cli.compilerOptions.assets = assets;
    return true;
}
