import { LogLevel } from '@nestjs/common';
import { EnvironmentEnum } from '../../shared/enums/index.js';

interface EnvSettings {
    logger:  LogLevel[];
    swagger: boolean;
}

// Fixed per-environment settings — not env vars.
export const environmentSettings: Record<string, EnvSettings> = {
    [EnvironmentEnum.PRODUCTION]: {
        logger:  ['error'],
        swagger: false,
    },
    [EnvironmentEnum.DEVELOPMENT]: {
        logger:  ['error', 'warn', 'log'],
        swagger: true,
    },
    [EnvironmentEnum.TEST]: {
        logger:  ['error'],
        swagger: true,
    },
    [EnvironmentEnum.DEBUG]: {
        logger:  ['error', 'warn', 'log', 'debug', 'verbose'],
        swagger: true,
    },
};

// Runs in main.ts BEFORE Nest builds ConfigModule, so the Joi/Zod env validation has not run yet. Fail here with a
// clear message instead of letting an unknown NODE_ENV become `undefined` and crash on destructuring.
export function getEnvSettings(nodeEnv?: string): EnvSettings {
    const env      = nodeEnv ?? EnvironmentEnum.DEVELOPMENT;
    const settings = environmentSettings[env];

    if (!settings) {
        throw new Error(`Invalid NODE_ENV "${env}". Allowed values: ${Object.keys(environmentSettings).join(', ')}.`);
    }
    return settings;
}
