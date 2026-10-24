import { Injectable } from '@nestjs/common';
import type { Mailable } from '@nestjs/mail';
import { formatLifetime } from './format-lifetime.js';

interface CodeMailData { code: string; expiresInMinutes: number }

// Template: src/plugins/mailer/templates/auth/verify-email.html (+ .txt). Values are prepared here: templates have no helpers.
@Injectable()
export class VerifyEmailMail implements Mailable<CodeMailData> {
    render({ code, expiresInMinutes }: CodeMailData) {
        return { subject: 'Your verification code', template: 'auth/verify-email', context: { code, lifetime: formatLifetime(expiresInMinutes) } };
    }
}
