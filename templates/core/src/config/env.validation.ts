import Joi from 'joi';
import { EnvironmentEnum } from '../shared/enums/index.js';

// A duration such as 30s, 15m, 7d (see parseDuration).
const DURATION = /^\d+\s*[smhdw]$/;

export const envValidation = Joi.object({

    // -- Server ---------------------------------------------------------------
    NODE_ENV:     Joi.string().valid(...Object.values(EnvironmentEnum)).default(EnvironmentEnum.DEVELOPMENT),
    PORT:         Joi.number().default(3000),
    API_PREFIX:   Joi.string().default('api'),
    // '*' is for development only: in production the allowed origins must be listed.
    // oxlint-disable-next-line unicorn/no-thenable -- `then` is Joi's own API for conditional rules, not a thenable object
    CORS_ORIGINS: Joi.string().default('*').when('NODE_ENV', { is: EnvironmentEnum.PRODUCTION, then: Joi.string().invalid('*').required() }),
    TRUST_PROXY:  Joi.string().allow('').default(''),

    // -- Rate limiting (per client IP) ----------------------------------------
    THROTTLE_TTL:          Joi.string().pattern(DURATION).default('1m'),
    THROTTLE_LIMIT:        Joi.number().integer().positive().default(100),
    THROTTLE_STRICT_TTL:   Joi.string().pattern(DURATION).default('1m'),
    THROTTLE_STRICT_LIMIT: Joi.number().integer().positive().default(10),

    // {{PLUGIN_ENV_VARS}}
});
