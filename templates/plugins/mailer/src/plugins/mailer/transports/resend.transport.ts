import { ResendTransport } from '@nestjs/mail';
import type { TransportDefinition } from '../interfaces/index.js';

export const resendTransport: TransportDefinition = {
    env:    [{ name: 'RESEND_API_KEY', required: true, example: 're_xxx', description: 'Resend API key' }],
    create: (cfg) => new ResendTransport({ apiKey: cfg.get<string>('RESEND_API_KEY')! }),
};
