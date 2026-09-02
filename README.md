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

## Plugins

| Plugin | Description |
|---|---|
| **Database** | TypeORM with PostgreSQL, MySQL, MariaDB, SQLite, or SQL Server. Includes base entity, migrations setup, and a seed script. |
| **Auth** | JWT authentication with refresh token rotation. Includes users module, roles module, guards, and decorators. Requires Database. |
| **Mailer** | Email sending via SMTP or HTTP API (Resend/SendGrid). Port & Adapter pattern. |
| **WebSockets** | Real-time communication via Socket.io. |
| **PDF** | PDF generation via Puppeteer. |

## What you get

Every generated project includes:

- **NestJS 11 or 12** — the CLI detects the NestJS version you have installed globally and scaffolds a matching, verified-compatible project instead of always chasing `@latest` (see [`src/nest-version.ts`](src/nest-version.ts))
- **Joi** env validation with `.env.example`
- **Swagger** API documentation at `/api/docs`
- **Health check** endpoint at `/api/health`
- **HttpExceptionFilter** — consistent `{ statusCode, error, message, path, timestamp }` response format
- **Dockerfile** + **docker-compose.yml** ready to use
- **`.claude/`** — Claude Code development rules and slash commands tailored to your selected plugins

## Generated project structure

```
src/
├── app/        # App-level logic (auth, health) — not a DB table
├── modules/    # Domain modules — each one maps to a DB table
├── plugins/    # Port & Adapter pattern (mailer, pdf, socket)
├── database/   # TypeORM setup, base entity, seeds
├── config/     # Global ConfigModule, Joi env validation
└── shared/     # DTOs, ORM utils, filters, decorators, swagger utils
```

## Claude Code integration

Each generated project includes a `.claude/CLAUDE.md` and slash commands:

```
/nestjs/module <Name>       — scaffold a complete CRUD module
/nestjs/exception <M> <T>  — add an exception to a module
/nestjs/plugin <N> <A>     — scaffold a port/adapter plugin
/db/map                    — map a database schema to modules (requires Database plugin)
```

## After generation

```bash
cd <project-name>
cp .env.example .env        # fill in your values
npm run migration:run       # (if Database plugin)
npm run seed                # (if Auth plugin) creates root user
npm run start:dev
```

Swagger: `http://localhost:3000/api/docs`

## Development

```bash
npm install
npm run build   # tsc
npm test        # vitest — plugin resolution, version detection, all file builders
```
