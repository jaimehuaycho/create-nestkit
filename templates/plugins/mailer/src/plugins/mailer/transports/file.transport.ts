import { FileMailTransport } from '@nestjs/mail';
import type { TransportDefinition } from '../interfaces/index.js';

// Development: every mail becomes an .eml file you can open in a mail client. var/ is git-ignored.
export const fileTransport: TransportDefinition = {
    development: true,
    env:         [],
    create:      () => new FileMailTransport({ directory: 'var/mail' }),
};
