# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## Unreleased

### Changed
- Publishing is now guarded: `npm run build` cleans `dist/` first, and `prepublishOnly` runs the build, the tests
  and a package check that fails if internal files would ship or required ones are missing.
- CI also runs on `develop` and verifies the package contents.

### Fixed
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
