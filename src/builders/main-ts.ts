import { Manifest } from '../generator';

/**
 * Generates main.ts content tailored to the selected plugins and DB driver.
 * Core imports are always included; plugin-specific imports and banner fields
 * are injected only when the relevant plugin is in the resolved set.
 */
export function buildMainTs(manifests: Manifest[], dbDriver: string, projectName: string): string {
    const ids       = new Set(manifests.map(m => m.id));
    const hasDb      = ids.has('database');
    const hasAuth    = ids.has('auth');
    const hasObserve = ids.has('observe');
    const isPostgres = hasDb && dbDriver === 'postgres';

    // ── Imports ────────────────────────────────────────────────────────────
    const lines: string[] = [];

    lines.push(`import 'dotenv/config';`);
    lines.push(``);
    if (isPostgres) lines.push(`import { types } from 'pg';`);
    lines.push(`import { NestFactory } from '@nestjs/core';`);
    lines.push(`import { ValidationPipe } from '@nestjs/common';`);
    lines.push(`import { AppModule } from './app.module.js';`);
    lines.push(`import { AppConfig } from './config/services/app.config.js';`);
    lines.push(`import { getEnvSettings } from './config/helpers/environment.js';`);
    lines.push(`import { getCorsOptions } from './config/helpers/cors.js';`);
    lines.push(`import { setupSwagger } from './config/helpers/swagger.js';`);
    lines.push(`import { logServerStatus } from './config/helpers/logger.js';`);
    lines.push(`import { HttpExceptionFilter } from './shared/filters/index.js';`);
    if (hasAuth)    lines.push(`import { JwtConfig } from './app/auth/config/jwt.config.js';`);
    if (hasDb)      lines.push(`import { DatabaseConfig } from './database/config/database.config.js';`);
    if (hasObserve) lines.push(`import { ObserveInstrument } from './plugins/observe/observe.instrument.js';`);

    // ── Bootstrap function ────────────────────────────────────────────────
    lines.push(``);
    lines.push(`async function bootstrap() {`);
    lines.push(`    const { logger, swagger } = getEnvSettings(process.env.NODE_ENV);`);
    if (isPostgres) {
        lines.push(``);
        lines.push(`    // BigInt / bigserial (OID 20) arrives as string from pg — cast for auto-increment IDs.`);
        lines.push(`    types.setTypeParser(20, Number);`);
    }
    lines.push(``);
    lines.push(hasObserve
        ? `    const app = await NestFactory.create(AppModule, { logger, instrument: ObserveInstrument });`
        : `    const app = await NestFactory.create(AppModule, { logger });`);
    lines.push(`    const cfg = app.get(AppConfig);`);
    lines.push(``);
    lines.push(`    app.setGlobalPrefix(cfg.apiPrefix);`);
    lines.push(``);
    lines.push(`    if (swagger) {`);
    lines.push(`        setupSwagger(app, {`);
    lines.push(`            title:       '${projectName}',`);
    lines.push(`            description: 'API Documentation',`);
    lines.push(`            version:     '1.0',`);
    lines.push(`            path:        'api/docs',`);
    lines.push(`        });`);
    lines.push(`    }`);
    lines.push(``);
    lines.push(`    app.enableCors(getCorsOptions(cfg.corsOrigins));`);
    lines.push(``);
    lines.push(`    app.useGlobalPipes(new ValidationPipe({`);
    lines.push(`        transform:            true,`);
    lines.push(`        whitelist:            true,`);
    lines.push(`        forbidNonWhitelisted: true,`);
    lines.push(`        transformOptions:     { enableImplicitConversion: false },`);
    lines.push(`    }));`);
    lines.push(``);
    lines.push(`    app.useGlobalFilters(new HttpExceptionFilter());`);
    lines.push(``);
    lines.push(`    await app.listen(cfg.port);`);
    lines.push(``);
    if (hasAuth) lines.push(`    const jwtCfg = app.get(JwtConfig,      { strict: false });`);
    if (hasDb)   lines.push(`    const dbCfg  = app.get(DatabaseConfig, { strict: false });`);
    lines.push(``);
    lines.push(`    logServerStatus(cfg, '${projectName}', {`);
    lines.push(`        swagger:   swagger,`);
    lines.push(`        docsPath:  'api/docs',`);
    lines.push(`        cors:      cfg.corsOrigins,`);
    lines.push(`        logLevels: logger,`);
    if (hasAuth) lines.push(`        jwtActive: jwtCfg.isActive,`);
    if (hasDb) {
        lines.push(`        dbLogs:    dbCfg.logging,`);
        lines.push(`        database:  \`\${dbCfg.host}:\${dbCfg.port}/\${dbCfg.database}\`,`);
    }
    if (hasObserve) lines.push(`        observeConfigured: !!process.env.OBSERVE_APP_KEY,`);
    lines.push(`    });`);
    lines.push(`}`);
    lines.push(`bootstrap();`);
    lines.push(``);

    return lines.join('\n');
}
