import { SesTransport } from '@nestjs/mail';
import type { TransportDefinition } from '../interfaces/index.js';

// Static credentials. To use an instance role instead, pass `credentials` from the AWS SDK's provider chain and drop the keys from `env`.
export const sesTransport: TransportDefinition = {
    env: [
        { name: 'AWS_REGION',            required: true, example: 'eu-west-1', description: 'AWS region of your SES identity' },
        { name: 'AWS_ACCESS_KEY_ID',     required: true, example: 'AKIA...',   description: 'AWS access key' },
        { name: 'AWS_SECRET_ACCESS_KEY', required: true, example: 'xxx',       description: 'AWS secret key' },
        { name: 'AWS_SESSION_TOKEN',                     example: 'xxx',       description: 'Only for temporary credentials' },
    ],
    create: (cfg) => new SesTransport({
        region:      cfg.get<string>('AWS_REGION')!,
        credentials: {
            accessKeyId:     cfg.get<string>('AWS_ACCESS_KEY_ID')!,
            secretAccessKey: cfg.get<string>('AWS_SECRET_ACCESS_KEY')!,
            sessionToken:    cfg.get<string>('AWS_SESSION_TOKEN') || undefined,
        },
    }),
};
