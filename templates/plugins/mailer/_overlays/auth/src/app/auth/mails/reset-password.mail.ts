import { Injectable } from '@nestjs/common';
import type { Mailable } from '@nestjs/mail';
import { formatLifetime } from './format-lifetime.js';

interface CodeMailData { code: string; expiresInMinutes: number }

// Template: src/plugins/mailer/templates/auth/reset-password.html (+ .txt).
@Injectable()
export class ResetPasswordMail implements Mailable<CodeMailData> {
    render({ code, expiresInMinutes }: CodeMailData) {
        return { subject: 'Your password reset code', template: 'auth/reset-password', context: { code, lifetime: formatLifetime(expiresInMinutes) } };
    }
}
