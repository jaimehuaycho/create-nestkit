#!/usr/bin/env node
// PostToolUse hook (Edit|Write): formats the file Claude just changed with the project's Prettier,
// so formatting never costs a turn or shows up as noise in diffs. Always exits 0: formatting is
// best-effort and must never fail or slow a session. (.cjs: stays CommonJS in ESM projects.)
const fs            = require('fs');
const path          = require('path');
const { spawnSync } = require('child_process');

const FORMATTABLE = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json']);
const SKIPPED_DIRS = ['node_modules/', 'dist/', 'coverage/', '.git/'];

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
    let event;
    try { event = JSON.parse(input); } catch { process.exit(0); }

    const filePath = event.tool_input && event.tool_input.file_path;
    if (!filePath) process.exit(0);

    const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const abs  = path.resolve(root, filePath);
    const rel  = path.relative(root, abs).split(path.sep).join('/');

    if (rel.startsWith('..') || !fs.existsSync(abs)) process.exit(0);          // outside the project / gone
    if (!FORMATTABLE.has(path.extname(abs)))         process.exit(0);
    if (SKIPPED_DIRS.some((d) => rel.startsWith(d))) process.exit(0);
    if (path.basename(abs) === 'package-lock.json')  process.exit(0);

    // --no-install: use the project's own Prettier, never download one mid-session.
    spawnSync('npx', ['--no-install', 'prettier', '--write', abs], {
        cwd: root,
        stdio: 'ignore',
        timeout: 20000,
        shell: process.platform === 'win32',                                   // npx is npx.cmd on Windows
    });
    process.exit(0);
});
