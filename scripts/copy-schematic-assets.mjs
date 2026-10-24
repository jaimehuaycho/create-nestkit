// tsc only emits .ts: the schematics collection and schemas are JSON the engine reads by path, so copy them next to the compiled factories.
import { cpSync } from 'node:fs';

cpSync('src/schematics', 'dist/schematics', {
    recursive: true,
    filter:    (source) => !source.endsWith('.ts'),
});
