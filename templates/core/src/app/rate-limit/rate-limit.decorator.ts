import { SetMetadata } from '@nestjs/common';

export const STRICT_RATE_LIMIT_KEY = 'rateLimit:strict';

/**
 * Applies the strict limit (THROTTLE_STRICT_LIMIT per THROTTLE_STRICT_TTL) on top of the general one. For endpoints that are cheap to abuse or costly to
 * serve: sign-in, registration, password reset, anything that sends an e-mail. Works on a route or a whole controller.
 */
export const StrictRateLimit = () => SetMetadata(STRICT_RATE_LIMIT_KEY, true);
