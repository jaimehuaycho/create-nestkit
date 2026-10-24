import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { MailerConfigurationException } from '../exceptions/index.js';
import { MailerConfig } from '../config/index.js';
import { TRANSPORTS } from '../transports/index.js';
import { MailTransport } from '@nestjs/mail';

const configWith = (env: Record<string, unknown>) => new MailerConfig(new ConfigService(env));

describe('mailer configuration', () => {
    it('builds every transport from valid settings', () => {
        const settings = {
            MAIL_FROM: 'App <noreply@example.com>', SMTP_HOST: 'smtp.example.com', RESEND_API_KEY: 'k',
            POSTMARK_SERVER_TOKEN: 'k', SENDGRID_API_KEY: 'k', AWS_REGION: 'eu-west-1', AWS_ACCESS_KEY_ID: 'k', AWS_SECRET_ACCESS_KEY: 'k',
        };
        for (const transport of Object.keys(TRANSPORTS)) {
            expect(configWith({ ...settings, MAIL_TRANSPORT: transport }).createTransport()).toBeInstanceOf(MailTransport);
        }
    });

    it('refuses an unknown transport and lists the available ones', () => {
        expect(() => configWith({ MAIL_TRANSPORT: 'carrier-pigeon' })).toThrow(/Available: log, file, smtp, resend, postmark, sendgrid, ses/);
        expect(() => configWith({ MAIL_TRANSPORT: 'constructor' })).toThrow(MailerConfigurationException);
    });

    it('refuses a transport whose settings are missing, naming each with an example', () => {
        expect(() => configWith({ MAIL_TRANSPORT: 'smtp', MAIL_FROM: 'a@example.com' })).toThrow(/SMTP_HOST must be set when MAIL_TRANSPORT=smtp: SMTP_HOST \(SMTP server, e\.g\. smtp\.example\.com\)/);
        expect(() => configWith({ MAIL_TRANSPORT: 'resend', MAIL_FROM: 'a@example.com' })).toThrow(/RESEND_API_KEY must be set/);
        expect(() => configWith({ MAIL_TRANSPORT: 'ses', MAIL_FROM: 'a@example.com', AWS_REGION: 'eu-west-1' })).toThrow(/AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY must be set/);
    });

    it('requires a sender for a real transport but not while developing', () => {
        expect(() => configWith({ MAIL_TRANSPORT: 'resend', RESEND_API_KEY: 'k' })).toThrow(/MAIL_FROM must be set/);
        expect(configWith({ MAIL_TRANSPORT: 'log' }).from).toContain('noreply@example.com');
    });

    it('refuses the development transports in production', () => {
        expect(() => configWith({ MAIL_TRANSPORT: 'log', NODE_ENV: 'production' })).toThrow(MailerConfigurationException);
        expect(() => configWith({ MAIL_TRANSPORT: 'file', NODE_ENV: 'production' })).toThrow(MailerConfigurationException);
    });
});
