import { Provider } from '@nestjs/common';
import { AuthMailer, SimulatedAuthMailer } from './services/auth-mailer.service.js';

/**
 * Which AuthMailer the auth flows use. By default the SIMULATED one, which only logs the message (and refuses to start in production).
 * When the Mailer plugin is selected the generator replaces this file with one that binds MailAuthMailer, which sends real e-mail.
 * To use your own: { provide: AuthMailer, useClass: YourAuthMailer }.
 */
export const AUTH_MAILER_PROVIDER: Provider = { provide: AuthMailer, useClass: SimulatedAuthMailer };
