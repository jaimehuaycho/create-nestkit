import { SmtpTransport } from '@nestjs/mail';
import type { TransportDefinition } from '../interfaces/index.js';

// Port 587 upgrades with STARTTLS (required), 465 is TLS from the first byte; certificates are verified and the password is never sent in
// clear except to localhost. `pool` reuses connections (up to 5, 100 messages each, closed after 30 s idle and on shutdown, which needs
// app.enableShutdownHooks()): it is what makes a burst of mail cheap. For a private CA add `tls: { ca: readFileSync(...) }`; for Gmail or
// Microsoft 365 with OAuth pass `auth: { user, accessToken }`; for DKIM add `dkim`.
export const smtpTransport: TransportDefinition = {
    env: [
        { name: 'SMTP_HOST', required: true, example: 'smtp.example.com', description: 'SMTP server' },
        { name: 'SMTP_PORT',                  example: '587',              description: '587 (STARTTLS, default) or 465 (TLS from the start)' },
        { name: 'SMTP_USER',                  example: 'you@example.com',  description: 'Login. Optional: a local catcher such as Mailpit needs none' },
        { name: 'SMTP_PASS',                  example: 'your_password',    description: 'Password or app password' },
    ],
    create: (cfg) => {
        const user = cfg.get<string>('SMTP_USER');
        const pass = cfg.get<string>('SMTP_PASS');
        return new SmtpTransport({
            host: cfg.get<string>('SMTP_HOST')!,
            port: Number(cfg.get('SMTP_PORT', 587)),
            auth: user && pass ? { user, pass } : undefined,
            pool: true,
        });
    },
};
