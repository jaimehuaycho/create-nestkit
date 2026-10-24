import { Provider } from '@nestjs/common';
import { AuthMailer } from './services/auth-mailer.service.js';
import { MailAuthMailer } from './services/mail-auth-mailer.service.js';

/**
 * The Mailer plugin is selected, so the verification and reset codes are sent as real e-mail (MAIL_TRANSPORT decides how).
 * To use your own: { provide: AuthMailer, useClass: YourAuthMailer }.
 */
export const AUTH_MAILER_PROVIDER: Provider = { provide: AuthMailer, useClass: MailAuthMailer };
