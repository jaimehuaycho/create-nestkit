# /db/map — Map a database schema to modules

You are given a database schema (as SQL DDL, TypeORM entities, a folder of files, or a plain description). Your job is to map it to NestJS modules following the project's methodology exactly.

## Step 1 — Understand the schema

Read or ask the user for the schema. Accept any format:
- SQL `CREATE TABLE` statements
- Existing TypeORM entity files
- A folder path containing entity/model files
- A plain-text description of tables and their columns

## Step 2 — Identify modules

For each table that is NOT a pure join table:
- Propose a module name (singular PascalCase entity, plural for module/service/controller)
- Identify which folder it belongs to:
  - `src/modules/` → table-backed domain entities (products, orders, invoices...)
  - `src/app/` → app-level logic without own table (orchestration, auth flows)

Ask the user: "Should I generate full CRUD for all modules, or select specific ones?"

## Step 3 — Confirm auth adaptation (if applicable)

If a users table exists with different columns than the default (no `email`, different auth field, no `password`):
- Ask: "Your users table uses `$FIELD` instead of email. Should I adapt the auth login to use that field?"
- Update `UserForAuthDto` and `auth.service.ts` login accordingly if confirmed.
- Keep all other auth patterns (JWT, refresh rotation, guards) identical.

## Step 4 — Generate each module

For each confirmed module, scaffold using `/nestjs/module <Name>`.

For the `users` table (if present and auth is active):
- Check if the existing `UsersModule` covers it or if it needs adaptation.
- Never create a duplicate users module — adapt the existing one if columns differ.

## Step 5 — Register modules

After scaffolding, add each new module to `src/app.module.ts` imports.
Run `npm run build` to verify no TypeScript errors.

## Step 6 — Migrations

Ask: "Do you want me to generate and run migrations now?"
If yes:
```bash
npm run migration:generate -- src/database/migrations/initial
npm run migration:run
```

---

**Key constraints:**
- Every generated service follows the generic DTO pattern from CLAUDE.md exactly.
- Every generated controller has the error dictionary JSDoc and variadic swagger decorators.
- Never inline exception throws — always create exception classes.
- Soft delete by default; ask before using hard delete.
