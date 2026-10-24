import { describe, it, expect } from 'vitest';
import { activeOverlays } from './overlays';
import { Manifest, PluginOverlay } from './generator';

const plugin = (id: string, overlays?: PluginOverlay[]): Manifest => ({
    id, requires: [], appModule: { imports: [], modules: [] }, dependencies: { prod: [], dev: [] }, scripts: {}, overlays,
});

const MAILER = plugin('mailer', [
    { dir: '_overlays/esm-tests', when: { moduleSystem: 'esm' } },
    { dir: '_overlays/auth',      when: { plugin: 'auth' } },
]);

describe('activeOverlays', () => {
    it('is empty for plugins that declare none', () => {
        expect(activeOverlays([plugin('database'), plugin('pdf')], 'esm')).toEqual([]);
    });

    it('applies a module-system overlay only to that module system', () => {
        expect(activeOverlays([MAILER], 'esm')).toEqual(['plugins/mailer/_overlays/esm-tests']);
        expect(activeOverlays([MAILER], 'cjs')).toEqual([]);
    });

    it('applies a plugin overlay only when the other plugin is selected, whatever the order', () => {
        expect(activeOverlays([MAILER, plugin('auth')], 'cjs')).toEqual(['plugins/mailer/_overlays/auth']);
        expect(activeOverlays([plugin('auth'), MAILER], 'cjs')).toEqual(['plugins/mailer/_overlays/auth']);
        expect(activeOverlays([MAILER], 'cjs')).toEqual([]);
    });

    it('requires every condition of one overlay to hold', () => {
        const both = plugin('x', [{ dir: 'o', when: { plugin: 'auth', moduleSystem: 'esm' } }]);
        expect(activeOverlays([both, plugin('auth')], 'esm')).toEqual(['plugins/x/o']);
        expect(activeOverlays([both, plugin('auth')], 'cjs')).toEqual([]);
        expect(activeOverlays([both], 'esm')).toEqual([]);
    });
});
