import { LogMailTransport } from '@nestjs/mail';
import type { TransportDefinition } from '../interfaces/index.js';

// Development: prints each mail (recipients and subject, the text body at debug level) and sends nothing.
export const logTransport: TransportDefinition = {
    development: true,
    env:         [],
    create:      () => new LogMailTransport(),
};
