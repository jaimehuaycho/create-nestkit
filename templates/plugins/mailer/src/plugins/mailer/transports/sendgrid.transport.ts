import { SendGridTransport } from '@nestjs/mail';
import type { TransportDefinition } from '../interfaces/index.js';

export const sendgridTransport: TransportDefinition = {
    env:    [{ name: 'SENDGRID_API_KEY', required: true, example: 'SG.xxx', description: 'SendGrid API key' }],
    create: (cfg) => new SendGridTransport({ apiKey: cfg.get<string>('SENDGRID_API_KEY')! }),
};
