// `nest new` writes a tsconfig.json whose `types` name the test runner's globals (`vitest/globals` for an ESM project, `jest` for CommonJS), and
// create-nestkit replaces that file with its own. Without `types`, TypeScript sees `describe`/`it`/`expect` nowhere and `tsc --noEmit` fails on any
// spec that relies on the globals. This keeps our file and carries Nest's `types` over, so the runner Nest chose keeps working.
export function nestTypesOf(nestTsconfig: string): string[] | null {
    try {
        const types = JSON.parse(nestTsconfig)?.compilerOptions?.types;
        if (Array.isArray(types)) return types.filter((t): t is string => typeof t === 'string');
    } catch {
        // Not plain JSON (comments, trailing commas): read just the `types` list.
    }
    const match = /"types"\s*:\s*\[([^\]]*)\]/.exec(nestTsconfig);
    if (!match) return null;
    return [...match[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
}

export function buildTsconfig(ours: string, nestGenerated: string): string {
    const types = nestTypesOf(nestGenerated);
    if (!types || types.length === 0) return ours;

    const config = JSON.parse(ours);
    config.compilerOptions = { ...config.compilerOptions, types };
    return JSON.stringify(config, null, 2) + '\n';
}
