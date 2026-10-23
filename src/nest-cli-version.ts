import { execSync } from 'node:child_process';
import { NEST } from './nest-version';

// `npx @nestjs/cli@^12` is cached under the text of its spec. Once any 12.x has been run on a machine, npx reuses that install for the rest
// of the range and never asks the registry again, so the project is scaffolded with whatever 12.x happened to be cached (found: 12.0.0 on a
// machine where 12.0.10 was published, with the older project template). Asking for the exact latest version makes the spec change with each
// release, and every machine scaffolds with the same, current template.

const STABLE = /^\d+\.\d+\.\d+$/;

const parts = (version: string): number[] => version.split('.').map(Number);

// Picks the highest stable version out of what `npm view <range> version --json` prints (a string for one match, an array for several).
// Compared numerically: lexicographically "12.0.9" would beat "12.0.10".
export function highestVersion(output: unknown): string | null {
    const candidates = (Array.isArray(output) ? output : [output]).filter((v): v is string => typeof v === 'string' && STABLE.test(v));
    if (candidates.length === 0) return null;

    return candidates.reduce((best, current) => {
        const [a, b] = [parts(best), parts(current)];
        for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? best : current;
        return best;
    });
}

const lookupFromNpm = (): string =>
    execSync(`npm view @nestjs/cli@${NEST.cliRange} version --json`, { encoding: 'utf8', timeout: 20_000, stdio: ['ignore', 'pipe', 'ignore'] });

// The @nestjs/cli version to run, exact. Falls back to the range (today's behaviour) when the registry cannot be asked: without a network
// there is nothing to scaffold from anyway, and the range keeps the failure message the one npx already prints.
export function resolveNestCliVersion(lookup: () => string = lookupFromNpm): string {
    try {
        return highestVersion(JSON.parse(lookup())) ?? NEST.cliRange;
    } catch {
        return NEST.cliRange;
    }
}
