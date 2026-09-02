import Joi from 'joi';
import { EnvironmentEnum } from '../shared/enums/index.js';

export const envValidation = Joi.object({

    // -- Server ---------------------------------------------------------------
    NODE_ENV:        Joi.string().valid(...Object.values(EnvironmentEnum)).default(EnvironmentEnum.DEVELOPMENT),
    PORT:            Joi.number().default(3000),
    API_PREFIX:      Joi.string().default('api'),
    DOMAIN_FRONTEND: Joi.string().default('*'),

    // {{PLUGIN_ENV_VARS}}
});
