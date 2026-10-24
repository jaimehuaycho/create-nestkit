const UNITS: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };

// '15m' -> 900000, '7d' -> 604800000. Plain numbers are milliseconds. Throws on anything else, so a typo in .env fails at startup.
export function parseDuration(value: string | number): number {
    if (typeof value === 'number') return value;
    const match = /^(\d+)\s*([smhdw])$/.exec(value.trim());
    if (!match) throw new Error(`Invalid duration "${value}". Use a number followed by s, m, h, d or w (for example 15m, 7d).`);
    return Number(match[1]) * UNITS[match[2]];
}
