import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module.js';
import { HealthModule } from './app/health/health.module.js';
// {{PLUGIN_IMPORTS}}

@Module({
    imports: [
        AppConfigModule,
        HealthModule,
        // {{PLUGIN_MODULES}}
    ],
})
export class AppModule {}
