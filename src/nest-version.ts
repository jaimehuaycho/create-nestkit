// The NestJS major this scaffold targets. Only the LATEST major is supported: when Nest ships a new one, this
// package moves to it (a new create-nestkit major) and older majors are not maintained here. There is
// deliberately no detection of the user's globally installed `nest`: `nest new` always runs through `npx @nestjs/cli@<version>`, where the
// version is the latest one inside `cliRange` (resolved in nest-cli-version.ts, because npx would otherwise reuse a cached older 12.x), so the
// generated project does not depend on what is installed or cached on the machine.
//
// Nest ships breaking scaffold changes per major (v12 switched `nest new` to a TypeScript 6 / ESM-or-CJS scaffold,
// oxlint, vitest or jest), so the companion @nestjs/* packages are pinned to the range verified against this major.
export const NEST = {
    major:    12,
    cliRange: '^12',

    // Tightly-coupled @nestjs/* packages, pinned to the range verified against this major. Anything not listed here
    // resolves to npm's `latest` when the project is generated.
    packages: {
        '@nestjs/config':             '^12',
        '@nestjs/swagger':            '^12',
        '@nestjs/terminus':           '^12',
        '@nestjs/typeorm':            '^12',
        '@nestjs/jwt':                '^12',
        '@nestjs/passport':           '^12',
        '@nestjs/websockets':         '^12',
        '@nestjs/platform-socket.io': '^12',
    } as Record<string, string>,

    // Extra flags for `nest new`, for prompts the CLI introduces that create-nestkit's own flags don't cover
    // (--skip-install etc.), so scaffolding stays non-interactive where Nest allows it. `--no-observe` skips the
    // observability prompt. The ESM/CommonJS prompt has no flag and reads /dev/tty directly, so it stays
    // interactive (see generator.ts); the templates compile under both module systems.
    newFlags: ['--no-observe'],
} as const;
