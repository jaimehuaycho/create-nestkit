# @darkj/create-nestkit

[![CI](https://github.com/jaimehuaycho/create-nestkit/actions/workflows/ci.yml/badge.svg)](https://github.com/jaimehuaycho/create-nestkit/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/%40darkj%2Fcreate-nestkit.svg)](https://www.npmjs.com/package/@darkj/create-nestkit)
[![license](https://img.shields.io/npm/l/%40darkj%2Fcreate-nestkit.svg)](./LICENSE)

CLI scaffolder for production-ready NestJS backends. Generates a fully configured project with the plugins you choose.

## Usage

```bash
npx @darkj/create-nestkit
```

Answer the prompts and get a working NestJS project in seconds. Requires Node.js 20 or later.

## Plugins

| Plugin | Description |
|---|---|
| **Database** | TypeORM with PostgreSQL, MySQL, MariaDB, SQLite, or SQL Server. Includes base entity, migrations setup, and a seed script. |
| **Auth** | JWT authentication with refresh token rotation. Includes users module, roles module, guards, and decorators. Requires Database. |
| **Mailer** | Email sending via SMTP or HTTP API. The API adapter works with Resend out of the box; other providers (SendGrid, Mailgun, Postmark) need a one-method change (`buildPayload()`). Port & Adapter pattern. |
| **WebSockets** | Real-time communication via Socket.io. |
| **PDF** | PDF generation via Puppeteer. |
| **Observability** | Tracing and metrics via [Nest Observe](https://observe.nestjs.com) (`@nestjs/observe`). Only offered when NestJS 12+ is in use. Needs a free Nest Observe account. |

## What you get

Every generated project includes:

- **NestJS 11 or 12** — the CLI detects the NestJS version you have installed globally and scaffolds a matching, verified-compatible project instead of always chasing `@latest` (see [`src/nest-version.ts`](src/nest-version.ts))
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
