import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MailEvents } from '@nestjs/mail';
import type { Subscription } from 'rxjs';
import { redactAddresses } from '../utils/index.js';

/**
 * One log line per delivery, from the events the mailer publishes after its retries. Recipients are left out on purpose (they are
 * personal data), and addresses inside error messages are redacted: the subject and the message id are enough to find a mail in the
 * transport's own dashboard. Metrics or alerting
 * can subscribe to the same `MailEvents.events$`, or to the diagnostics channels `nestjs:mail:sent` and `nestjs:mail:failed`.
 */
@Injectable()
export class MailEventsLogger implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger('Mail');
    private subscription?: Subscription;

    constructor(private readonly events: MailEvents) {}

    onModuleInit(): void {
        this.subscription = this.events.events$.subscribe((event) => {
            if (event.type === 'sent') {
                this.logger.log(`"${event.subject}" sent by ${event.transport} (${event.attempts} attempt${event.attempts === 1 ? '' : 's'}, ${event.durationMs} ms) ${event.messageId}`);
                return;
            }
            const reason = redactAddresses(event.error instanceof Error ? event.error.message : String(event.error));
            this.logger.error(`"${event.subject}" NOT delivered by ${event.transport} after ${event.attempts} attempt(s)${event.permanent ? ' (permanent failure)' : ''}: ${reason}`);
        });
    }

    onModuleDestroy(): void {
        this.subscription?.unsubscribe();
    }
}
