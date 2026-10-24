import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileTemplateEngine, MailModule } from '@nestjs/mail';
import { join } from 'path';
import { MailerConfig } from './config/index.js';
import { MailDispatcher, MailEventsLogger } from './services/index.js';

// process.cwd() (not import.meta/__dirname) so this resolves the same under CJS and ESM builds:
// Nest always runs the compiled output from the project root. The templates are copied to dist by nest-cli.json `assets`.
const TEMPLATES_DIR = join(process.cwd(), 'dist', 'plugins', 'mailer', 'templates');

/**
 * E-mail for the whole application, on Nest's own mail module (@nestjs/mail). Where you send, inject one of:
 *   - `MailDispatcher` (this plugin): `dispatch()` sends in the background, the usual choice inside a request;
 *   - `Mailer` (@nestjs/mail): `send()` waits for the delivery and throws a MailError if it fails for good.
 * Mail classes live next to the feature that sends them (`<feature>/mails/*.mail.ts`) and their templates in templates/<feature>/.
 * MAIL_TRANSPORT picks how it is delivered; the list, and how to add one, is transports/index.ts. Call `app.enableShutdownHooks()` in
 * main.ts so deliveries in flight finish and SMTP connections close when the process stops.
 */
@Global()
@Module({
    imports: [
        MailModule.forRootAsync({
            inject:     [ConfigService],
            useFactory: (cfg: ConfigService) => {
                const mail = new MailerConfig(cfg);
                return {
                    transport: mail.createTransport(),
                    from:      mail.from,
                    // layout.html wraps every mail; development reads the files every time, so edits show without a restart.
                    templates: new FileTemplateEngine({ dir: TEMPLATES_DIR, layout: 'layout', cache: mail.isProduction }),
                };
            },
        }),
    ],
    providers: [MailEventsLogger, MailDispatcher],
    exports:   [MailDispatcher],
})
export class MailerModule {}
