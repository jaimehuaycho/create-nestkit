import type { ConfigService } from '@nestjs/config';
import type { MailTransport } from '@nestjs/mail';
import type { TransportVariable } from './transport-variable.interface.js';

/** Everything the plugin needs to know about one way of delivering mail. One file per transport in transports/, registered in transports/index.ts. */
export interface TransportDefinition {
    /** Builds the transport. Read the variables listed in `env` from `cfg`. */
    create:       (cfg: ConfigService) => MailTransport;
    /** The variables this transport reads: they differ per transport. Each must also be in .env.example and env.validation.ts (a spec checks it). */
    env:          TransportVariable[];
    /** Prints or stores mail instead of sending it. Refused when NODE_ENV=production, and MAIL_FROM is optional. */
    development?: boolean;
}
