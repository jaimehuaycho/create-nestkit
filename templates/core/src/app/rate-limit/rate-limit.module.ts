import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RateLimitConfig } from './rate-limit.config.js';
import { STRICT_RATE_LIMIT_KEY } from './rate-limit.decorator.js';

/**
 * Rate limiting for the whole API, independent of Auth. THROTTLE_TTL / THROTTLE_LIMIT set the general limit (every route, per client
 * IP); routes marked with @StrictRateLimit() also get THROTTLE_STRICT_LIMIT per THROTTLE_STRICT_TTL. Import this module BEFORE the others
 * in AppModule so the guard runs first. Behind a reverse proxy set TRUST_PROXY, or every client shares one bucket. Opt a route out with
 * @SkipThrottle() (health checks do). In-memory per instance: use a shared store (Redis) when you run several instances. This guard
 * covers HTTP only: WebSocket gateways need their own guard (see the Nest docs).
 */
@Module({
    imports: [
        ThrottlerModule.forRootAsync({
            inject:     [ConfigService],
            useFactory: (cfg: ConfigService) => {
                const rl = new RateLimitConfig(cfg);
                return {
                errorMessage: 'Too many requests. Try again later.',
                throttlers: [
                    { name: 'default', ttl: rl.ttlMs, limit: rl.limit },
                    {
                        name: 'strict',
                        ttl:  rl.strictTtlMs,
                        limit: rl.strictLimit,
                        // Only counts on routes (or controllers) that opted in.
                        skipIf: (ctx) => !(Reflect.getMetadata(STRICT_RATE_LIMIT_KEY, ctx.getHandler()) ?? Reflect.getMetadata(STRICT_RATE_LIMIT_KEY, ctx.getClass())),
                    },
                ],
                };
            },
        }),
    ],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class RateLimitModule {}
