import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

// Accepts '*', a single origin, or a comma-separated list of origins.
export function getCorsOptions(allowedOrigins: string): CorsOptions {
    if (allowedOrigins === '*') {
        // Any origin, so NO credentials: reflecting every origin together with credentials lets any site act as the signed-in user.
        return { origin: true, methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', credentials: false };
    }

    const origins = allowedOrigins.split(',').map(o => o.trim());
    return {
        origin: (origin, callback) => {
            if (!origin || origins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error(`Origin "${origin}" not allowed by CORS`), false);
            }
        },
        methods:     'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
    };
}
