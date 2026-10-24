import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { FileTemplateEngine, InMemoryMailTransport, MailError, Mailer, MailTemplateEngine, MailTransport } from '@nestjs/mail';
import { join } from 'path';
import { MailDispatcher } from '../services/index.js';
import { MailerModule } from '../mailer.module.js';
import { WelcomeMail } from '../mails/welcome.mail.js';

// Its own minimal configuration, not AppConfigModule: that one validates the variables of EVERY plugin in the project, so this spec
// would need a complete .env. The mailbox replaces the real transport, and the templates are read from src (dist exists only after a build).
const TEST_CONFIG = ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ({ NODE_ENV: 'test', MAIL_TRANSPORT: 'log' })] });

async function setup() {
    const mailbox = new InMemoryMailTransport();
    const templates = new FileTemplateEngine({ dir: join(process.cwd(), 'src', 'plugins', 'mailer', 'templates'), layout: 'layout', cache: false });
    const moduleRef = await Test.createTestingModule({ imports: [TEST_CONFIG, MailerModule] })
        .overrideProvider(MailTransport).useValue(mailbox)
        .overrideProvider(MailTemplateEngine).useValue(templates)
        .compile();
    await moduleRef.init();
    return { mailbox, mailer: moduleRef.get(Mailer), mails: moduleRef.get(MailDispatcher) };
}

// Spies must never leak into the next test, even when an assertion fails before the test restores them.
afterEach(() => vi.restoreAllMocks());

describe('Mailer (the Nest mail module, as registered by this plugin)', () => {
    it('sends a template inside the layout, escaping what the user typed', async () => {
        const { mailbox, mailer } = await setup();
        const result = await mailer.send({ to: 'ada@example.com', subject: 'Welcome', template: 'welcome', context: { name: '<b>Ada</b>' } });

        expect(result.accepted).toEqual(['ada@example.com']);
        const mail = mailbox.assertSent({ to: 'ada@example.com', template: 'welcome' });
        expect(mail.html).toContain('&lt;b&gt;Ada&lt;/b&gt;');
        expect(mail.html).toContain('<!doctype html>');          // the layout wraps the body
        expect(mail.html).toContain('The team');                 // ...and includes the signature partial
        expect(mail.text).toContain('Welcome, <b>Ada</b>');      // the .txt part is not HTML: nothing to escape
    });

    it('sends a mail class', async () => {
        const { mailbox, mailer } = await setup();
        await mailer.send(WelcomeMail, { to: 'ada@example.com', data: { name: 'Ada' } });
        expect(mailbox.assertSent({ mail: WelcomeMail }).subject).toBe('Welcome, Ada');
    });

    it('throws a MailError when the delivery fails for good', async () => {
        const { mailbox, mailer } = await setup();
        mailbox.failNext(new MailError('mailbox full', { permanent: true }));
        await expect(mailer.send({ to: 'ada@example.com', subject: 'Hi', text: 'plain' })).rejects.toBeInstanceOf(MailError);
    });

    it('rejects a malformed recipient before sending anything', async () => {
        const { mailbox, mailer } = await setup();
        await expect(mailer.send({ to: 'not-an-email', subject: 'Hi', text: 'plain' })).rejects.toBeInstanceOf(MailError);
        mailbox.assertNotSent();
    });
});

describe('MailEventsLogger', () => {
    it('logs each delivery without writing the recipient', async () => {
        const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
        const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        const { mailbox, mailer } = await setup();

        await mailer.send({ to: 'ada@example.com', subject: 'Hello', text: 'plain' });
        mailbox.failNext(new MailError('550 <bob@example.com>: user unknown', { permanent: true }));
        await mailer.send({ to: 'bob@example.com', subject: 'Broken', text: 'plain' }).catch(() => undefined);

        const lines = [...log.mock.calls, ...error.mock.calls].map(([line]) => String(line));
        expect(lines.some((line) => line.includes('"Hello" sent by'))).toBe(true);
        expect(lines.some((line) => line.includes('"Broken" NOT delivered') && line.includes('permanent') && line.includes('<address>: user unknown'))).toBe(true);
        expect(lines.some((line) => line.includes('ada@') || line.includes('bob@'))).toBe(false);   // neither the recipients nor addresses in the errors
    });
});

describe('MailDispatcher', () => {
    it('returns at once and the mail arrives in the background', async () => {
        const { mailbox, mails } = await setup();
        expect(mails.dispatch(WelcomeMail, { to: 'ada@example.com', data: { name: 'Ada' } })).toBeUndefined();
        await vi.waitFor(() => mailbox.assertSent({ to: 'ada@example.com', mail: WelcomeMail }));
    });

    it('logs a mail that never reached delivery, without the address, and does not throw', async () => {
        const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        const { mailbox, mails } = await setup();

        expect(() => mails.dispatch({ to: 'secret@not-an-email', subject: 'Broken address', text: 'plain' })).not.toThrow();
        await vi.waitFor(() => expect(error).toHaveBeenCalled());

        const line = String(error.mock.calls[0][0]);
        expect(line).toContain('"Broken address" was not sent');
        expect(line).not.toContain('secret@');
        expect(line).toContain('<address>');   // the reason stays, the address does not
        mailbox.assertNotSent();
    });

    it('leaves a delivery failure to the events logger: one line, no unhandled rejection', async () => {
        const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
        const unhandled = vi.fn();
        process.on('unhandledRejection', unhandled);
        const { mailbox, mails } = await setup();

        mailbox.failNext(new MailError('mailbox full', { permanent: true }));
        mails.dispatch({ to: 'ada@example.com', subject: 'Will fail', text: 'plain' });
        await vi.waitFor(() => expect(error).toHaveBeenCalled());
        await new Promise((resolve) => setTimeout(resolve, 30));

        const lines = error.mock.calls.map(([line]) => String(line));
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('"Will fail" NOT delivered');
        expect(unhandled).not.toHaveBeenCalled();
        process.off('unhandledRejection', unhandled);
    });
});
