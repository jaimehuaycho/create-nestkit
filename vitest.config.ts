import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // .tmp/ is the scratch directory (sample projects, downloaded schematics...): never test it.
        exclude: ['**/node_modules/**', 'dist/**', '.tmp/**'],
    },
});
