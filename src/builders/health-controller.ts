import { Manifest } from '../generator';

// health.controller.ts is generated (not a static template) because its shape depends on
// two independent plugin choices: the DB ping check only makes sense when TypeOrmModule
// is actually registered, and @Public() only exists when the auth plugin ships it.
export function buildHealthController(manifests: Manifest[]): string {
    const ids     = new Set(manifests.map(m => m.id));
    const hasDb   = ids.has('database');
    const hasAuth = ids.has('auth');

    const lines: string[] = [];

    lines.push(`import { Controller, Get } from '@nestjs/common';`);
    lines.push(`import { ApiOperation, ApiTags } from '@nestjs/swagger';`);
    lines.push(`import {`);
    lines.push(`    HealthCheck, HealthCheckService,`);
    lines.push(hasDb
        ? `    TypeOrmHealthIndicator, MemoryHealthIndicator, DiskHealthIndicator,`
        : `    MemoryHealthIndicator, DiskHealthIndicator,`);
    lines.push(`} from '@nestjs/terminus';`);
    if (hasAuth) lines.push(`import { Public } from '../../auth/decorators/index.js';`);

    lines.push(``);
    if (hasAuth) lines.push(`// @Public() — Docker, Kubernetes, and monitoring tools have no JWT token.`);
    lines.push(`@ApiTags('Health')`);
    lines.push(`@Controller('health')`);
    lines.push(`export class HealthController {`);
    lines.push(`    constructor(`);
    lines.push(`        private readonly health: HealthCheckService,`);
    if (hasDb) lines.push(`        private readonly db:     TypeOrmHealthIndicator,`);
    lines.push(`        private readonly memory: MemoryHealthIndicator,`);
    lines.push(`        private readonly disk:   DiskHealthIndicator,`);
    lines.push(`    ) {}`);

    lines.push(``);
    lines.push(`    @Get()`);
    if (hasAuth) lines.push(`    @Public()`);
    lines.push(`    @HealthCheck()`);
    lines.push(`    @ApiOperation({`);
    lines.push(`        summary:     'Application health',`);
    lines.push(`        description: 'Returns 200 if all checks pass, 503 if any check fails. Consumed by Docker, Kubernetes, load balancers, and uptime monitors.',`);
    lines.push(`    })`);
    lines.push(`    check() {`);
    lines.push(`        return this.health.check([`);
    if (hasDb) {
        lines.push(`            // Runs SELECT 1 against the TypeORM connection.`);
        lines.push(`            () => this.db.pingCheck('database'),`);
        lines.push(``);
    }
    lines.push(`            // Fails if Node.js heap exceeds 300 MB — adjust to your server specs.`);
    lines.push(`            () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),`);
    lines.push(``);
    lines.push(`            // Fails if disk usage exceeds 90%. Remove if the app writes no local files.`);
    lines.push(`            () => this.disk.checkStorage('disk', { path: '/', thresholdPercent: 0.9 }),`);
    lines.push(`        ]);`);
    lines.push(`    }`);
    lines.push(`}`);
    lines.push(``);

    return lines.join('\n');
}
