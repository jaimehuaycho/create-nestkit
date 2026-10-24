import { describe, it, expect } from 'vitest';
import { APP_NAME_PATH, buildAppName } from './app-name';

describe('buildAppName', () => {
    it('exports the project name as APP_NAME', () => {
        expect(buildAppName('my-api')).toContain("export const APP_NAME = 'my-api';");
    });

    it('lives where main.ts imports it from', () => {
        expect(APP_NAME_PATH).toBe('src/config/app-name.ts');
    });
});
