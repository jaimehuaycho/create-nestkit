import { Manifest } from './generator';

// The overlay folders (relative to templates/) to lay over the project, in plugin order. An overlay applies when EVERY condition in its
// `when` holds: the other plugin is selected, and/or the project uses that module system.
export function activeOverlays(manifests: Manifest[], moduleSystem: 'esm' | 'cjs'): string[] {
    const selected = new Set(manifests.map(m => m.id));

    return manifests.flatMap(m =>
        (m.overlays ?? [])
            .filter(({ when }) =>
                (when.plugin === undefined || selected.has(when.plugin)) &&
                (when.moduleSystem === undefined || when.moduleSystem === moduleSystem))
            .map(({ dir }) => `plugins/${m.id}/${dir}`),
    );
}
