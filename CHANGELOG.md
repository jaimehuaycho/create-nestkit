# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## Unreleased

### Added
- Generated projects now ship a complete Claude Code setup in `.claude/`:
  - `settings.json` with a permission baseline (the checks and read-only git run without asking; `.env` files
    cannot be read; migrations, seeding and `git push` ask first) and hooks that format edited files and block
    edits to `.env*`, lockfiles, applied migrations and `.git/`.
  - Subagents: `code-reviewer` (read-only, checks the diff against the project rules) and `test-runner`.
  - A `typecheck` npm script, and `.claude/settings.local.json` / `CLAUDE.local.md` in the generated `.gitignore`.
- A "Verify your work" section in the generated `CLAUDE.md` so Claude can check its own changes.

### Changed
- The generated slash commands are now skills, renamed: `/nestjs/module` → `/nest-module`,
  `/nestjs/exception` → `/nest-exception`, `/nestjs/plugin` → `/nest-plugin`, `/db/map` → `/db-map`.
  Existing generated projects are not affected.
- The generated `CLAUDE.md` shrank from ~150 to ~70 lines. Conventions moved to path-scoped rules
  (`.claude/rules/*.md` with `paths:`) that load only when you work in that area, instead of ~500 lines in every
  session. The Module/Service/Controller/Exception patterns now live in `rules/api-patterns.md`. The generated
  `CLAUDE.md` tells Claude to read an area's rule first when planning work there before touching any file.

### Changed
- Publishing is now guarded: `npm run build` cleans `dist/` first, and `prepublishOnly` runs the build, the tests
  and a package check that fails if internal files would ship or required ones are missing.
- CI also runs on `develop` and verifies the package contents.

### Security
- The project name is now validated before it is used in the `nest new` command. Names containing spaces, shell
  characters or path separators (for example `x; rm -rf ~`) are rejected instead of being passed to the shell.

### Fixed
- The generated docs pointed to `src/*/CLAUDE.md` files that were never generated; they now reference the real
  `.claude/rules/` files, and a test checks every generated reference across all plugin combinations.
- The generated `CLAUDE.md` described the seed as only creating the root user; it now matches what the seed does.
- The CLI refuses to generate into a path that already exists, instead of handing it to `nest new`.
- The Database slash commands (`/nestjs/module`, `/db/map`) were not tracked in git because of an unanchored
  ignore rule, so a fresh clone would have built projects without them.

## 1.2.1 - 2026-09-02

### Changed
- The Observability plugin now lives under `src/plugins/observe/` in generated projects, like the other
  integrations, and its docs are consolidated into `.claude/rules/plugins.md`.

## 1.2.0 - 2026-09-02

### Added
- Observability plugin (Nest Observe, `@nestjs/observe`), offered only when NestJS 12+ is in use.
- Plugin manifests accept `minNestMajor`; unsupported plugins are hidden from the prompt and rejected by the
  generator.
- Generated `README.md` describing only the plugins you selected.
- Generated `.claude/context/` journal (decisions and plans) and a "Starting Point, Not a Contract" section.

### Changed
- Database-specific code (`HealthController` DB check, `shared/orm/`, `FindOptions`) and its `.claude/` docs are
  now generated only when the Database plugin is selected.
- `DOMAIN_FRONTEND` was renamed to `CORS_ORIGINS`.

### Fixed
- `HealthController` always injected the TypeORM health indicator, even without the Database plugin.

## 1.1.1 - 2026-09-02

### Fixed
- Scaffolding on NestJS 12 no longer stops at the observability prompt (`--no-observe`).

## 1.1.0 - 2026-09-02
Published before this changelog existed. See the git history and the npm release.

## 1.0.1 - 2026-05-29
Published before this changelog existed.

## 1.0.0 - 2026-05-29
Initial release.
