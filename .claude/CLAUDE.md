# create-nestkit — CLI Development Context

This is a Node.js + TypeScript CLI that scaffolds NestJS projects. When working here,
Claude is helping develop the CLI tool itself, not a NestJS application.

## How the CLI works

```
src/index.ts          → entry point, prompts (uses @clack/prompts)
src/generator.ts      → core logic: resolves plugins, copies templates, runs npm install
src/builders/         → dynamic file generators (files that vary per plugin selection)
templates/
├── base/             → static files copied to every project (tsconfig, .gitignore, etc.)
├── core/src/         → base NestJS source (main.ts, config/, shared/, health module)
└── plugins/          → one folder per plugin
    └── {plugin}/
        ├── _manifest.json         → plugin metadata (see below)
        ├── _env.fragment          → env vars to add to .env
        ├── _env.example.fragment  → env vars to add to .env.example
        └── src/                   → source files to copy into the generated project
```

## Plugin manifest structure

```json
{
  "id": "plugin-name",
  "requires": ["other-plugin"],      // transitive deps, auto-resolved
  "appModule": {
    "imports": ["import { X } from './path';"],
    "modules": ["X"]
  },
  "envVars": ["VAR_NAME"],
  "dependencies": { "prod": [], "dev": [] },
  "scripts": {}
}
```

## Generator flow (src/generator.ts)

1. Run `@nestjs/cli new` to scaffold base NestJS project
2. Delete default files (app.controller, app.service, main.ts, etc.)
3. Copy `templates/core/src/` into the project
4. For each resolved plugin: copy `templates/plugins/{id}/src/` into the project
5. Build dynamic files: `app.module.ts`, `env.validation.ts`, `Dockerfile`, `docker-compose.yml`, `.env.example`
6. Run `npm install` with merged dependencies

## Builders (src/builders/)

Each builder generates one dynamic file by reading a base template and merging plugin contributions:

- `app-module.ts` → reads core `app.module.ts`, injects plugin imports + module registrations
- `env-validation.ts` → reads core validation schema, appends plugin env var schemas
- `env-example.ts` → merges `_env.example.fragment` files from active plugins
- `package-json.ts` → merges plugin scripts into `package.json`
- `dockerfile.ts` → adjusts base Dockerfile for plugin needs
- `docker-compose.ts` → adds DB service + volumes based on selected db driver

## Available slash commands

- `/cli/add-plugin <name>` — scaffold a new plugin folder with manifest + template structure

## Rules when modifying the CLI

- Plugins must be self-contained: everything a plugin needs lives in its `templates/plugins/{id}/` folder
- Manifests drive everything — if a plugin needs a dep, env var, or app.module import, it goes in `_manifest.json`
- Transitive resolution is automatic via `resolvePlugins()` — declare `requires` in the manifest, don't hardcode order
- Dynamic files (app.module, env.validation) are built by the builders — never hardcode plugin logic in `generator.ts`
- Template files use `{{VAR}}` for substitution — only `projectName` is available by default
- Files/dirs starting with `_` are skipped by `copyDir()` (manifests and fragments are never copied to the project)
