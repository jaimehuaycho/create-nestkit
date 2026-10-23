# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## Unreleased

### Removed (BREAKING)
- **NestJS 11 is no longer supported.** The package now targets only the latest NestJS major (12): every project is
  scaffolded with `@nestjs/cli@^12` and the `@nestjs/*` packages pinned to `^12`. Removed the detection of a globally
  installed `nest`, the `NESTKIT_NEST_VERSION` override and the manifest field `minNestMajor`; Observability is
  always offered. When NestJS ships a new major, this package moves to it. Use an older release of create-nestkit
  for NestJS 11.
- **The SQLite database option was removed.** It is meant for local use, not for the projects this scaffold targets. The
  engines are PostgreSQL, MySQL, MariaDB and SQL Server. (It also could not start: it generated `DB_TYPE=sqlite`, which
  TypeORM 1.x rejects.)
- Minimum Node.js is now what the Nest 12 toolchain declares: `^22.22.3 || ^24.15.0 || >=26` (was `>=20`). CI runs
  on Node 22 and 24.

### Added
- **Choose the password hashing algorithm when Auth is selected:** bcrypt (default) or Argon2id. The generated
  `src/shared/security/password.util.ts` exports the same `hashPassword`, `comparePassword` and `PASSWORD_MAX_BYTES` for
  both, so the users service, auth service, seed and DTOs do not depend on the choice. Only the chosen library is
  installed (and approved in `allowScripts`); projects without Auth no longer install `bcrypt` at all. bcrypt keeps its
  72-byte limit; Argon2id uses the library defaults (64 MiB, 3 iterations, 4 lanes) with a 256-byte input guard.
- The README has a Requirements section (Node, npm, NestJS) and states which NestJS version the scaffold targets and
  what it reproduces.
- Generated projects now ship a complete Claude Code setup in `.claude/`:
  - `settings.json` with a permission baseline (the checks and read-only git run without asking; `.env` files
    cannot be read; migrations, seeding and `git push` ask first) and hooks that format edited files and block
    edits to `.env*`, lockfiles, applied migrations and `.git/`.
  - Subagents: `code-reviewer` (read-only, checks the diff against the project rules) and `test-runner`.
  - A `typecheck` npm script, and `.claude/settings.local.json` / `CLAUDE.local.md` in the generated `.gitignore`.
- A "Verify your work" section in the generated `CLAUDE.md` so Claude can check its own changes.

### Changed
- **Every dependency is now pinned to a major version** (`src/dependencies.ts`): TypeORM `^1`, Joi `^18`, Puppeteer `^25`, and
  so on. Before, only `@nestjs/*` were pinned and everything else installed whatever was latest on the day, so a new major
  could change generated projects with no change in this repo (that is how TypeORM 1.x broke the SQLite option). A test
  fails if the generator installs a package without a range.
- Removed packages that were not needed: `swagger-ui-express` (`@nestjs/swagger` 12 bundles its UI), `@types/socket.io`
  (deprecated stub; socket.io ships its own types) and `@types/nodemailer` (nodemailer 10 ships its own types). Projects with
  the mailer or sockets no longer install them.
- The generated `package.json` now declares an npm `allowScripts` policy before the first install: it approves the
  packages that need install scripts for the selected plugins (`puppeteer` downloads Chrome, `bcrypt` is
  native) and denies the telemetry script of `@scarf/scarf`. npm 11 only warns today but has announced
  it will block unreviewed scripts, which would have silently broken the PDF plugin.
- The first-run steps in the generated README and `CLAUDE.md` are now accurate: start the database, generate your own
  migration, run it, then optionally seed. The generated README states that no migration or seed runs automatically
  and none is shipped. The CLI's closing message stays the short classic one; the detail lives in the README. It also explains `npm audit` noise from the Nest
  scaffold's dev tooling and the `allowScripts` section.
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
- **Refresh-token rotation did not work.** Refresh tokens were stored as a bcrypt hash, but bcrypt only reads the first
  72 bytes and a JWT is ~180, so a token of the same user matched the stored hash of any other: rotated-out tokens kept
  working and reuse was never detected. They are now stored as a SHA-256 digest (exact, constant-time comparison) and
  each refresh token carries a unique `jti`. Verified end to end against PostgreSQL: replaying a rotated token returns
  401 and revokes all sessions.
- Passwords are limited to 72 **bytes** (new `@MaxBytes` validator) in the register, login, create and update DTOs,
  because bcrypt silently ignores the rest (bcrypt README, OWASP Password Storage Cheat Sheet). They allowed 255.
- The project name is now validated before it is used in the `nest new` command. Names containing spaces, shell
  characters or path separators (for example `x; rm -rf ~`) are rejected instead of being passed to the shell.

### Fixed
- The Docker healthcheck of projects with the PDF plugin always failed: it used `wget`, which `node:22-bookworm-slim`
  does not ship (verified in Docker). Both Dockerfiles now healthcheck with Node's own `fetch`.
- Mailer templates never reached `dist/`: `nest-cli.json` had no `assets` entry. Plugins can now declare `nestAssets`,
  and the mailer copies `src/plugins/mailer/templates/**/*.hbs`, where its SMTP module reads them.
- An invalid `NODE_ENV` crashed with `Cannot destructure property 'logger'`. It now fails with
  `Invalid NODE_ENV "x". Allowed values: ...`.
- The generated docs taught `from 'src/...'` imports, which fail typecheck in ESM projects. They now show the real style
  (relative paths ending in `.js`) and say never to use the alias.
- The generated `.env.example` now separates every section with exactly one blank line. Some sections (for example
  Auth right after Seed) started directly under the previous variable, which made the file hard to read.
- The generated README told users to run `npm run migration:run` to "apply the initial schema", but no migration
  exists, so no tables were created and `npm run seed` failed.
- The generated README described `plugins/` as Port & Adapter only; socket and observe are plain modules.
- The generated docs pointed to `src/*/CLAUDE.md` files that were never generated; they now reference the real
  `.claude/rules/` files, and a test checks every generated reference across all plugin combinations.
- The generated `CLAUDE.md` described the seed as only creating the root user; it now matches what the seed does.
- The CLI refuses to generate into a path that already exists, instead of handing it to `nest new`.
- The Database slash commands (`/nestjs/module`, `/db/map`) were not tracked in git because of an unanchored
  ignore rule, so a fresh clone would have built projects without them.
- **Generated projects had no `.gitignore` for `.env`, `node_modules` or `dist`.** `nest new --skip-git` writes none (the CLI creates it only
  when it also runs `git init`), so a `git add .` committed the `.env` with its secrets. The project now gets Nest's own default list plus
  `.env.*` (keeping `.env.example`) and the personal Claude Code files; an existing file is kept and only completed. Checked against real `git check-ignore`.
- **The generated `main.ts` never enabled shutdown hooks.** On `SIGTERM` (`docker stop`, Kubernetes) Nest then skipped `onModuleDestroy` and
  `onApplicationShutdown`, so the database connection, and any module that drains work when stopping, were cut instead of closed. It now calls
  `app.enableShutdownHooks()`.
- **Projects were scaffolded with whatever Nest CLI 12.x was cached on the machine.** `npx @nestjs/cli@^12` is cached under the text of the range and
  never asks the registry again, so a machine that once ran 12.0.0 kept generating with the 12.0.0 template after 12.0.10 was published. The generator now
  resolves the latest 12.x itself and runs that exact version (falling back to the range offline). Among other things the current template no longer needs
  `vite-tsconfig-paths`, whose deprecated `tsconfck` dependency made `npm ci` fail in the generated Dockerfile.
- **The generated `docker-compose.yml` could not run the app.** The container read the host-side `.env`, so it looked for the database on `localhost`
  (itself) and listened on your own `PORT` while the mapping, `EXPOSE` and healthcheck assume 3000. The `app` service now sets `PORT: 3000` and, with a
  database, `DB_HOST: db` and the engine's container port in `environment`.
- **A project without the Database plugin still installed a database driver** (`pg`: the default engine was installed whatever was selected). The driver is
  now installed only with the Database plugin.
- **`tsc --noEmit` failed on any spec that used the test runner's globals.** The `tsconfig.json` we write replaced Nest's, dropping its `types`
  (`vitest/globals` for ESM, `jest` for CommonJS). They are now carried over.
- **`docker compose up` failed for any project with the Mailer plugin.** Its `.env.example` had `SMTP_FROM="My App" <noreply@example.com>`: text after a
  closing quote, which the strict parser of compose's `env_file` rejects (`unexpected character "<"`) before anything starts. The value is now one quoted
  string, and a test checks every line of the `.env.example` of every plugin and database combination against those rules.

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
