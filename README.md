# @darkj/create-nestkit

[![CI](https://github.com/jaimehuaycho/create-nestkit/actions/workflows/ci.yml/badge.svg)](https://github.com/jaimehuaycho/create-nestkit/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/%40darkj%2Fcreate-nestkit.svg)](https://www.npmjs.com/package/@darkj/create-nestkit)
[![license](https://img.shields.io/npm/l/%40darkj%2Fcreate-nestkit.svg)](./LICENSE)

CLI scaffolder for production-ready NestJS backends. Generates a fully configured project with the plugins you choose.

## Usage

```bash
npx @darkj/create-nestkit
```

Answer the prompts and get a working NestJS project in seconds.

## Requirements

Versions below come from the official NestJS 12 documentation ([First steps](https://docs.nestjs.com/first-steps),
[Migration guide](https://docs.nestjs.com/migration-guide)).

| | Version |
|---|---|
| **Node.js to scaffold** (this CLI and `@nestjs/cli` 12) | `^22.22.3`, `^24.15.0` or `>=26`. Node 21, 23 and 25 are not supported: the Nest CLI depends on the Angular devkit. |
| **Node.js to run a generated app** | `20.19+`, `22.12+` (on the 22 line) or `24+`. The generated `Dockerfile` uses Node 22. |
| **npm** | The one bundled with those Node versions. npm 11 is recommended: it understands the `allowScripts` policy the generated project declares. |
| **NestJS** | **12.** The CLI runs `@nestjs/cli@^12` through `npx`, so you do not need Nest installed globally, and the `@nestjs/*` packages are pinned to `^12`. |

If you pick **CommonJS with Jest** at Nest's prompt, note that Jest can load Nest 12's ESM-only packages only on
**Node 24.9 or later** (older versions fail with `ERR_REQUIRE_ASYNC_MODULE`). The ESM option, which uses Vitest, has no such limit.

### Which NestJS version this scaffold targets

This release scaffolds **NestJS 12 only**, and reproduces what `nest new` 12 generates: TypeScript 6, Prettier 3, oxlint,
and the module system and test runner you pick at Nest's own prompt (ESM with Vitest, or CommonJS with Jest).
There is no detection of a globally installed `nest`, and NestJS 11 is not supported.

When NestJS ships a new major, create-nestkit moves to it and publishes a new major version. Older NestJS majors are not
maintained here: use the matching older release of create-nestkit if you need one.

Other dependencies (TypeORM 1, Joi 18, Puppeteer 25 for PDF, and so on) resolve to their latest version when the
project is generated. Puppeteer needs Node 22.12+ (its package metadata), which the scaffold requirement above already covers.

## Plugins

| Plugin | Description |
|---|---|
| **Database** | TypeORM with PostgreSQL, MySQL, MariaDB, or SQL Server. Includes base entity, migrations setup, and a seed script. |
| **Auth** | JWT authentication with refresh token rotation. Includes users module, roles module, guards, and decorators. Requires Database. You choose the password hashing algorithm when you generate: **bcrypt** (default) or **Argon2id**. Both give the generated code the same `hashPassword` / `comparePassword` functions. |
| **Mailer** | Email sending via SMTP or HTTP API. The API adapter works with Resend out of the box; other providers (SendGrid, Mailgun, Postmark) need a one-method change (`buildPayload()`). Port & Adapter pattern. |
| **WebSockets** | Real-time communication via Socket.io. |
| **PDF** | PDF generation via Puppeteer. |
| **Observability** | Tracing and metrics via [Nest Observe](https://observe.nestjs.com) (`@nestjs/observe`). Needs a free Nest Observe account. |

## What you get

Every generated project includes:

- **NestJS 12** — `nest new` 12 as the base, with every `@nestjs/*` package pinned to `^12` (see [Requirements](#requirements))
- **Joi** env validation with `.env.example`
- **Swagger** API documentation at `/api/docs`
- **Health check** endpoint at `/api/health`
- **HttpExceptionFilter** — consistent `{ statusCode, error, message, path, timestamp }` response format
- **Dockerfile** + **docker-compose.yml** ready to use
- **`.claude/`** — a ready-to-use Claude Code setup tailored to your selected plugins: lean `CLAUDE.md`, path-scoped rules, skills, subagents, permissions and hooks

## Generated project structure

```
src/
├── app/        # App-level logic (auth, health) — not a DB table
├── modules/    # Domain modules — each one maps to a DB table
├── plugins/    # Integrations: Port & Adapter (mailer, pdf) or plain modules (socket, observe)
├── database/   # TypeORM setup, base entity, seeds
├── config/     # Global ConfigModule, Joi env validation
└── shared/     # DTOs, ORM utils, filters, decorators, swagger utils
```

## Claude Code integration

Each generated project ships a `.claude/` folder so Claude Code works well from the first session. It follows
Claude Code's own guidance: a short always-loaded `CLAUDE.md`, area rules that load only when you touch that
area, guarantees enforced by settings rather than prose, and a way for Claude to verify its own work.

```
.claude/
├── CLAUDE.md          # what Claude needs every session: verify commands, structure, where rules live
├── rules/             # conventions per area, loaded only when matching files are read or edited
├── settings.json      # permissions + hooks (shared; personal overrides go in settings.local.json)
├── hooks/             # format edited files; block edits to .env*, lockfiles, applied migrations
├── agents/            # code-reviewer (read-only) and test-runner
├── skills/            # slash skills (below)
└── context/           # decision journal and saved plans: log why the project drifts from the rules
```

Skills:

```
/nest-module <Name>        — scaffold a complete CRUD module (requires Database plugin)
/nest-exception <M> <T>    — add an exception to a module
/nest-plugin <N> <A>       — scaffold a port/adapter plugin
/db-map                    — map a database schema to modules (requires Database plugin)
```

Permissions are conservative by default: Claude can run the checks (`typecheck`, `lint`, `test`, `build`) and
read-only git without asking, cannot read `.env` files, and asks before migrations, seeding or `git push`.

## After generation

```bash
cd <project-name>
cp .env.example .env        # fill in your values
npm run migration:run       # (if Database plugin)
npm run seed                # (if Auth plugin) seeds the root/admin/user roles + a root user
npm run start:dev
```

Swagger: `http://localhost:3000/api/docs`

## Development

```bash
npm install
npm run build   # tsc
npm test        # vitest — plugin resolution, version detection, all file builders
```
