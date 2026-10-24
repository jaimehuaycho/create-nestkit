import { Manifest } from '../generator';

// Scripts every generated project gets, on top of what `nest new` provides. `typecheck` is part of the
// verification loop documented in the generated CLAUDE.md; Nest's default has no type-only check.
const CORE_SCRIPTS: Record<string, string> = {
    typecheck: 'tsc --noEmit',
};

// Adds the core and plugin scripts to the package.json that Nest's application schematic generated.
// Dependencies are handled by running `npm install` directly in the project.
export function applyPluginScripts(pkg: any, manifests: Manifest[]): void {
    for (const [name, command] of Object.entries(CORE_SCRIPTS)) {
        if (!pkg.scripts[name]) pkg.scripts[name] = command;   // never overwrite one Nest already defines
    }

    for (const manifest of manifests) {
        Object.assign(pkg.scripts, manifest.scripts);
    }
}


// Install-script policy. npm (11.x) warns about dependencies whose install scripts are not covered by
// `allowScripts` and has announced it will block unreviewed ones in a future release. Declaring the policy up
// front keeps generated projects working then, and removes the warning wall from the first install.
//
// Approved: needed for the project to work. Name-only entries on purpose: they survive version bumps. Packages that only
// some selections need (puppeteer, the chosen password hasher) are added by the plugin manifest or the registry instead.
const CORE_ALLOWED_SCRIPTS = [
    'esbuild',    // tsx / vite: verifies its platform binary
    'fsevents',   // macOS file watching for the dev server
];
// Denied: not needed, and we choose not to run them.
const CORE_DENIED_SCRIPTS = [
    '@scarf/scarf',   // install-time telemetry, pulled in by swagger-ui-dist through @nestjs/swagger
];

export function applyInstallScriptPolicy(pkg: any, manifests: Manifest[], extraAllowed: string[] = []): void {
    const policy: Record<string, boolean> = { ...(pkg.allowScripts ?? {}) };
    const allowed = [...CORE_ALLOWED_SCRIPTS, ...manifests.flatMap(m => m.allowScripts ?? []), ...extraAllowed];

    for (const name of allowed)             if (!(name in policy)) policy[name] = true;
    for (const name of CORE_DENIED_SCRIPTS) if (!(name in policy)) policy[name] = false;

    pkg.allowScripts = policy;
}
