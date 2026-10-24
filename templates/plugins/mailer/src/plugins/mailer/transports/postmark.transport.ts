import { PostmarkTransport } from '@nestjs/mail';
import type { TransportDefinition } from '../interfaces/index.js';

export const postmarkTransport: TransportDefinition = {
    env:    [{ name: 'POSTMARK_SERVER_TOKEN', required: true, example: 'xxx', description: 'Postmark server API token' }],
    create: (cfg) => new PostmarkTransport({ serverToken: cfg.get<string>('POSTMARK_SERVER_TOKEN')! }),
};
