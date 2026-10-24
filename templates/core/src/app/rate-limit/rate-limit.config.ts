import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseDuration } from '../../shared/utils/duration.util.js';

/** The rate-limit settings from the environment, parsed once (built in the module factory). Names follow the Nest docs (THROTTLE_TTL, THROTTLE_LIMIT). */
@Injectable()
export class RateLimitConfig {
    /** General tier: window and requests allowed per client IP inside it. */
    readonly ttlMs:         number;
    readonly limit:         number;
    /** Strict tier (routes marked @StrictRateLimit()): applies on top of the general one. */
    readonly strictTtlMs:   number;
    readonly strictLimit:   number;

    constructor(cfg: ConfigService) {
        this.ttlMs       = parseDuration(cfg.get<string>('THROTTLE_TTL')!);
        this.limit       = cfg.get<number>('THROTTLE_LIMIT')!;
        this.strictTtlMs = parseDuration(cfg.get<string>('THROTTLE_STRICT_TTL')!);
        this.strictLimit = cfg.get<number>('THROTTLE_STRICT_LIMIT')!;
    }
}
