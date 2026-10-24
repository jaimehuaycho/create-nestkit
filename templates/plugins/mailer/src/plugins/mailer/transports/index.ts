import { fileTransport } from './file.transport.js';
import { logTransport } from './log.transport.js';
import { postmarkTransport } from './postmark.transport.js';
import { resendTransport } from './resend.transport.js';
import { sendgridTransport } from './sendgrid.transport.js';
import { sesTransport } from './ses.transport.js';
import { smtpTransport } from './smtp.transport.js';
import type { TransportDefinition } from '../interfaces/index.js';

/**
 * Every transport MAIL_TRANSPORT can name. To add one:
 *   1. create `<name>.transport.ts` here, exporting a TransportDefinition (its variables, and how to build it). A transport that Nest does
 *      not ship is a class extending `MailTransport` from '@nestjs/mail' (the Nest docs have a full Mailgun example): keep it next to its definition;
 *   2. register it below;
 *   3. add its variables to .env.example (a section "--- MAIL_TRANSPORT=<name>") and to env.validation.ts.
 * The spec fails until step 3 is done. Every transport except the development ones also needs MAIL_FROM, the sender each recipient sees.
 */
export const TRANSPORTS: Record<string, TransportDefinition> = {
    log:      logTransport,
    file:     fileTransport,
    smtp:     smtpTransport,
    resend:   resendTransport,
    postmark: postmarkTransport,
    sendgrid: sendgridTransport,
    ses:      sesTransport,
};
