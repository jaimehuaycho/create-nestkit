import { Injectable } from '@nestjs/common';
import { MailDispatcher } from '../../../plugins/mailer/index.js';
import { ResetPasswordMail } from '../mails/reset-password.mail.js';
import { VerifyEmailMail } from '../mails/verify-email.mail.js';
import { AuthMailer, CodeMail } from './auth-mailer.service.js';

/**
 * Sends the codes of the auth flows through the Mailer plugin, in the background: the request that asked for the code does not wait for
 * the mail server, and a failed delivery is logged by the plugin (never with the address). The single place that knows the auth mail classes.
 */
@Injectable()
export class MailAuthMailer extends AuthMailer {
    constructor(private readonly mails: MailDispatcher) {
        super();
    }

    sendEmailVerification({ to, code, expiresInMinutes }: CodeMail): void {
        this.mails.dispatch(VerifyEmailMail, { to, data: { code, expiresInMinutes } });
    }

    sendPasswordReset({ to, code, expiresInMinutes }: CodeMail): void {
        this.mails.dispatch(ResetPasswordMail, { to, data: { code, expiresInMinutes } });
    }
}
