import { Injectable, Logger, type Type } from '@nestjs/common';
import {
    Mailer, MailError, MailMessageError, MailTemplateError,
    type Mailable, type MailableSendOptions, type MailSendOptions,
} from '@nestjs/mail';
import { redactAddresses } from '../utils/index.js';

/**
 * Sends in the background: returns at once, so the request that asked for the mail does not wait for the mail server. The one place that
 * does it, so no caller leaves a promise floating (a rejection nobody catches ends the process on current Node) or swallows an error.
 *
 *   this.mails.dispatch(WelcomeMail, { to: user.email, data: { name: user.name } });
 *
 * Delivery failures (after the mailer's retries) are logged by MailEventsLogger, because the mailer publishes them as events. A mail that
 * never reached delivery (bad address, broken template or mail class) publishes no event, so it is logged here. Use `Mailer.send()`
 * yourself when the caller must know the outcome, and the transactional outbox (`@nestjs/outbox`) when the mail must not be lost if the
 * process dies before it is sent.
 */
@Injectable()
export class MailDispatcher {
    private readonly logger = new Logger('Mail');

    constructor(private readonly mailer: Mailer) {}

    dispatch(message: MailSendOptions): void;
    dispatch<M extends Mailable<any>>(mail: Type<M>, options: MailableSendOptions<Parameters<M['render']>[0]>): void;
    dispatch(...args: unknown[]): void {
        const send  = this.mailer.send.bind(this.mailer) as (...params: unknown[]) => Promise<unknown>;
        const label = typeof args[0] === 'function' ? args[0].name : String((args[0] as { subject?: string }).subject ?? 'mail');

        send(...args).catch((error: unknown) => {
            // A delivery failure is a MailError other than these two, and was already published as an event.
            const neverDelivered = !(error instanceof MailError) || error instanceof MailMessageError || error instanceof MailTemplateError;
            if (neverDelivered) {
                this.logger.error(`"${label}" was not sent: ${redactAddresses(error instanceof Error ? error.message : String(error))}`);
            }
        });
    }
}
