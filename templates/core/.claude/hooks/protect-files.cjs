#!/usr/bin/env node
// PreToolUse hook (Edit|Write): blocks edits Claude should never make directly.
// Exit 2 = block, and stderr is fed back to Claude so it can change approach. Exit 0 = allow.
// Written in Node (not bash + jq) so it works wherever the project's own tooling does. The .cjs extension
// keeps it CommonJS even when the project is ESM ("type": "module"), where a .js file would break `require`.
const fs   = require('fs');
const path = require('path');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
    let event;
    try { event = JSON.parse(input); } catch { process.exit(0); }   // never break the session on bad input

    const filePath = event.tool_input && event.tool_input.file_path;
    if (!filePath) process.exit(0);

    const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const abs  = path.resolve(root, filePath);
    const rel  = path.relative(root, abs).split(path.sep).join('/');
    const base = path.basename(abs);

    const block = (reason) => {
        process.stderr.write(`Blocked: ${rel}. ${reason}\n`);
        process.exit(2);
    };

    // Secrets: .env, .env.local, .env.production... but .env.example is documentation and stays editable.
    if (/^\.env(\..+)?$/.test(base) && base !== '.env.example') {
        block('Environment files hold secrets. Change .env.example and ask the user to update their own .env.');
    }

    if (['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'].includes(base)) {
        block('Lockfiles are generated. Use the package manager (npm install / npm uninstall) instead.');
    }

    if (rel === '.git' || rel.startsWith('.git/')) {
        block('Never edit git internals directly.');
    }

    // Applied migrations are history: editing one desyncs every database that already ran it.
    // Creating a NEW migration file is fine; modifying an existing one is not.
    if (rel.startsWith('src/database/migrations/') && fs.existsSync(abs)) {
        block('Existing migrations are immutable. Generate a new one with `npm run migration:generate -- src/database/migrations/<Name>`.');
    }

    process.exit(0);
});
