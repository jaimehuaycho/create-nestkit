import * as fs   from 'fs';
import * as path from 'path';

export function buildEnvValidation(
    templatePath: string,
    pluginIds:    string[],
    templatesDir: string,
): string {
    let content = fs.readFileSync(templatePath, 'utf-8');

    const fragments: string[] = [];

    for (const id of pluginIds) {
        const fragmentPath = path.join(templatesDir, 'plugins', id, '_env.fragment');
        if (fs.existsSync(fragmentPath)) {
            fragments.push(fs.readFileSync(fragmentPath, 'utf-8'));
        }
    }

    content = content.replace('    // {{PLUGIN_ENV_VARS}}', fragments.join(''));

    return content;
}
