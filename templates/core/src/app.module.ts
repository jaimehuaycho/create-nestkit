import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module.js';
import { RateLimitModule } from './app/rate-limit/rate-limit.module.js';
import { HealthModule } from './app/health/health.module.js';
// {{PLUGIN_IMPORTS}}

@Module({
    imports: [
        AppConfigModule,
        RateLimitModule,   // before the rest: its guard must run first
        HealthModule,
        // {{PLUGIN_MODULES}}
    ],
})
export class AppModule {}
