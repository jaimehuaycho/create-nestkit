import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// Supported NestJS majors — everything the generated templates are verified
// to compile & boot against. Nest ships breaking scaffold changes per major
// (e.g. v12 switched `nest new` to ESM + pulled in TypeScript 6's implicit
// `strict: true`), so each entry pins the companion @nestjs/* packages that
// are actually compatible with that major's peer dependencies.
//
// To add support for a new major once it's been verified: add an entry here.
// ---------------------------------------------------------------------------

export interface NestVersionProfile {
    major:    number;
    cliRange: string;
    packages: Record<string, string>;
}

export const SUPPORTED_NEST_VERSIONS: Record<number, NestVersionProfile> = {
    11: {
        major:    11,
        cliRange: '^11',
        packages: {
            '@nestjs/config':             '^4',   // v5+ dropped support for Nest 11's peer range
            '@nestjs/swagger':            '^11',
            '@nestjs/terminus':           '^11',
            '@nestjs/typeorm':            '^11',
            '@nestjs/jwt':                '^11',
            '@nestjs/passport':           '^11',
            '@nestjs/websockets':         '^11',
            '@nestjs/platform-socket.io': '^11',
        },
    },
    12: {
        major:    12,
        cliRange: '^12',
        packages: {
            '@nestjs/config':             '^12',
            '@nestjs/swagger':            '^12',
            '@nestjs/terminus':           '^12',
            '@nestjs/typeorm':            '^12',
            '@nestjs/jwt':                '^12',
            '@nestjs/passport':           '^12',
            '@nestjs/websockets':         '^12',
            '@nestjs/platform-socket.io': '^12',
        },
    },
};

// Used when nothing is detected on the user's machine, or the detected major isn't supported yet.
export const DEFAULT_NEST_MAJOR = 12;

// Reads the globally installed `nest` CLI's version (the version the user actually
// works with day to day). Returns null if the `nest` binary isn't on PATH — that's
// the common case for a fresh machine, not an error.
export function detectInstalledNestMajor(): number | null {
    try {
        const out   = execSync('nest --version', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        const major = parseInt(out.split('.')[0], 10);
        return Number.isFinite(major) ? major : null;
    } catch {
        return null;
    }
}

export function resolveNestVersion(): NestVersionProfile {
    // Explicit override — useful in CI, or when the global `nest` CLI doesn't match
    // what you want to scaffold for a particular client/project.
    const override = process.env.NESTKIT_NEST_VERSION ? parseInt(process.env.NESTKIT_NEST_VERSION, 10) : null;
    if (override != null && SUPPORTED_NEST_VERSIONS[override]) {
        console.log(`  Using NestJS v${override} (NESTKIT_NEST_VERSION override).`);
        return SUPPORTED_NEST_VERSIONS[override];
    }

    const detected = detectInstalledNestMajor();

    if (detected != null) {
        const profile = SUPPORTED_NEST_VERSIONS[detected];
        if (profile) {
            console.log(`  Detected NestJS v${detected} installed — scaffolding to match.`);
            return profile;
        }
        console.log(
            `  Detected NestJS v${detected} installed, but create-nestkit doesn't support it yet. ` +
            `Falling back to v${DEFAULT_NEST_MAJOR}.`,
        );
    }

    return SUPPORTED_NEST_VERSIONS[DEFAULT_NEST_MAJOR];
}
