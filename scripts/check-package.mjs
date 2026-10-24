// Guards what gets published to npm. Run by `prepublishOnly` and CI (after `npm run build`).
// Fails when something internal would ship, or when something the CLI needs at runtime is missing.
import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const FORBIDDEN = [
    { re: /^\.claude\//,           why: "the repo's own Claude Code config (templates/core/.claude is fine)" },
    { re: /^CLAUDE(\.local)?\.md$/, why: 'Claude Code instructions' },
    { re: /^\.github\//,           why: 'CI configuration' },
    { re: /^\.tmp\//,              why: 'scratch directory' },
    { re: /^src\//,                why: 'TypeScript sources (consumers only need dist/)' },
    { re: /^scripts\//,            why: 'repo tooling' },
    { re: /(^|\/)\.env(\.local)?$/, why: 'environment file' },
    { re: /(^|\/)\.npmrc$/,        why: 'npm credentials' },
    { re: /\.log$/,                why: 'log file' },
    { re: /^dist\/.*\.test\./,     why: 'compiled test file' },
    { re: /\.tsbuildinfo$/,        why: 'incremental build cache' },
];

const out = execSync('npm pack --dry-run --json --ignore-scripts', {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
});
const files = JSON.parse(out)[0].files.map((f) => f.path);

const required = [
    'package.json',
    'README.md',
    'LICENSE',
    'dist/index.js',
    'dist/generator.js',
    // The schematics engine reads these by path, tsc does not emit them (scripts/copy-schematic-assets.mjs).
    'dist/schematics/collection.json',
    'dist/schematics/app/schema.json',
    'templates/base/tsconfig.json',
    'templates/core/src/app.module.ts',
    // What every generated project's .claude/ is built from.
    'templates/core/.claude/skills/nest-plugin/SKILL.md',
    'templates/core/.claude/skills-db/nest-module/SKILL.md',
    'templates/core/.claude/agents/code-reviewer.md',
    'templates/core/.claude/hooks/protect-files.cjs',
    'templates/core/.claude/hooks/format.cjs',
    // Every plugin folder must ship its manifest, otherwise resolvePlugins() fails at runtime.
    ...readdirSync('templates/plugins').map((id) => `templates/plugins/${id}/_manifest.json`),
];

const problems = [];
for (const file of files) {
    const hit = FORBIDDEN.find(({ re }) => re.test(file));
    if (hit) problems.push(`unexpected file: ${file}  (${hit.why})`);
}
for (const file of required) {
    if (!files.includes(file)) problems.push(`missing file: ${file}`);
}

if (problems.length > 0) {
    console.error('Package check failed:\n' + problems.map((p) => `  - ${p}`).join('\n'));
    process.exit(1);
}
console.log(`Package check passed: ${files.length} files.`);
