import * as fs from 'fs';
import { Manifest } from '../generator';

export function buildAppModule(templatePath: string, manifests: Manifest[]): string {
    let content = fs.readFileSync(templatePath, 'utf-8');

    const imports = manifests
        .flatMap(m => m.appModule.imports)
        .join('\n');

    const modules = manifests
        .flatMap(m => m.appModule.modules)
        .map(m => `        ${m},`)
        .join('\n');

    content = content.replace('// {{PLUGIN_IMPORTS}}', imports);
    content = content.replace('        // {{PLUGIN_MODULES}}', modules);

    return content;
}
