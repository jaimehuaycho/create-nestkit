import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import { buildAppModule } from './app-module';
import { Manifest } from '../generator';

function fakeManifest(id: string, importLine: string, moduleExpr: string): Manifest {
    return {
        id,
        requires: [],
        appModule: { imports: [importLine], modules: [moduleExpr] },
        dependencies: { prod: [], dev: [] },
        scripts: {},
    };
}

describe('buildAppModule', () => {
    let tmpFile: string;

    afterEach(() => {
        if (tmpFile) fs.rmSync(tmpFile, { force: true });
    });

    it('injects each manifest import and module registration at their markers', () => {
        tmpFile = path.join(os.tmpdir(), `app-module-${Date.now()}.ts`);
        fs.writeFileSync(tmpFile, [
            `import { Module } from '@nestjs/common';`,
            `// {{PLUGIN_IMPORTS}}`,
            ``,
            `@Module({`,
            `    imports: [`,
            `        // {{PLUGIN_MODULES}}`,
            `    ],`,
            `})`,
            `export class AppModule {}`,
        ].join('\n'));

        const manifests = [
            fakeManifest('database', `import { DatabaseModule } from './database/database.module.js';`, 'DatabaseModule'),
            fakeManifest('mailer', `import { MailerModule } from './plugins/mailer/mailer.module.js';`, 'MailerModule.register()'),
        ];

        const result = buildAppModule(tmpFile, manifests);

        expect(result).toContain(`import { DatabaseModule } from './database/database.module.js';`);
        expect(result).toContain(`import { MailerModule } from './plugins/mailer/mailer.module.js';`);
        expect(result).toContain('DatabaseModule,');
        expect(result).toContain('MailerModule.register(),');
        expect(result).not.toContain('{{PLUGIN_IMPORTS}}');
        expect(result).not.toContain('{{PLUGIN_MODULES}}');
    });

    it('leaves the template untouched when no plugins are active', () => {
        tmpFile = path.join(os.tmpdir(), `app-module-empty-${Date.now()}.ts`);
        fs.writeFileSync(tmpFile, `// {{PLUGIN_IMPORTS}}\nexport class AppModule {}`);

        const result = buildAppModule(tmpFile, []);
        expect(result).toBe('\nexport class AppModule {}');
    });
});
