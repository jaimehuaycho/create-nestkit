import { ConfigService } from '@nestjs/config';
import type { MailTransport } from '@nestjs/mail';
import { MailerConfigurationException } from '../exceptions/index.js';
import type { TransportDefinition } from '../interfaces/index.js';
import { TRANSPORTS } from '../transports/index.js';

// The sender used while developing, when MAIL_FROM is not set. Real transports must set their own.
const DEVELOPMENT_FROM = 'Example App <noreply@example.com>';

// Wraps ConfigService for the mailer variables and checks them while the application starts, so a bad setup stops the boot
// instead of failing on the first e-mail. Built inside the module factory: @nestjs/mail's registration has no extraProviders.
export class MailerConfig {
    readonly transportName: string;
    readonly from:          string;
    readonly isProduction:  boolean;
    private readonly definition: TransportDefinition;

    constructor(private readonly cfg: ConfigService) {
        this.transportName = cfg.get<string>('MAIL_TRANSPORT', 'log');
        this.isProduction  = cfg.get<string>('NODE_ENV') === 'production';

        // hasOwn: a name such as "constructor" must not find something on Object.prototype.
        if (!Object.hasOwn(TRANSPORTS, this.transportName)) {
            throw new MailerConfigurationException(`unknown MAIL_TRANSPORT "${this.transportName}". Available: ${Object.keys(TRANSPORTS).join(', ')}.`);
        }
        this.definition = TRANSPORTS[this.transportName];

        // A development transport sends nothing and may print the body, which holds codes and links: never in production.
        if (this.definition.development && this.isProduction) {
            throw new MailerConfigurationException(`MAIL_TRANSPORT=${this.transportName} sends nothing; choose a real transport in production.`);
        }

        const missing = this.definition.env.filter((variable) => variable.required && !cfg.get<string>(variable.name));
        if (missing.length) {
            const list = missing.map((variable) => `${variable.name} (${variable.description}, e.g. ${variable.example})`).join('; ');
            throw new MailerConfigurationException(`${missing.map((variable) => variable.name).join(', ')} must be set when MAIL_TRANSPORT=${this.transportName}: ${list}.`);
        }

        const from = cfg.get<string>('MAIL_FROM');
        if (!from && !this.definition.development) {
            throw new MailerConfigurationException(`MAIL_FROM must be set when MAIL_TRANSPORT=${this.transportName} (the sender every recipient sees).`);
        }
        this.from = from || DEVELOPMENT_FROM;
    }

    createTransport(): MailTransport {
        return this.definition.create(this.cfg);
    }
}
