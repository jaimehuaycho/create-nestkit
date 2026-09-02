import { Module } from '@nestjs/common';
import { NestObserveModule } from './observe.instrument.js';
import { ObserveConfig } from './observe.config.js';

// Distributed tracing, auto-correlated logs, request/job metrics, and error telemetry —
// sign up at https://observe.nestjs.com to get OBSERVE_APP_KEY / OBSERVE_APP_SECRET.
// Without valid credentials, telemetry is silently dropped — the app still boots fine.
@Module({
    imports: [
        NestObserveModule.forRootAsync({
            // extraProviders: NestObserveModule.forRootAsync creates an internal module
            // that has no access to ObservabilityModule's own providers — bridges that gap.
            extraProviders: [ObserveConfig],
            inject:         [ObserveConfig],
            useFactory: (cfg: ObserveConfig) => ({
                appKey:    cfg.appKey,
                appSecret: cfg.appSecret,
                serviceId: cfg.serviceId,
            }),
        }),
    ],
})
export class ObservabilityModule {}
