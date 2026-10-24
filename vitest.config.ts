import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // .tmp/ is the scratch directory (sample projects, downloaded schematics...): never test it. templates/ holds the specs that
        // ship INSIDE generated projects; they run there, not here.
        exclude: ['**/node_modules/**', 'dist/**', '.tmp/**', 'templates/**'],
    },
});
