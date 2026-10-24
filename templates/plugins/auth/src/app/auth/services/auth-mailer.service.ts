import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AppConfig } from '../../../config/services/app.config.js';

/**
 * What the auth flows need from a mailer. Swap the implementation for a real one (the Mailer plugin) without touching the flows:
 *   { provide: AuthMailer, useClass: MyRealAuthMailer }  in AuthModule.
 */
export interface CodeMail {
    to:               string;
    /** The 6-digit code to show in the message. */
    code:             string;
    /** How long the code works, for the text of the message. */
    expiresInMinutes: number;
}

export abstract class AuthMailer {
    abstract sendEmailVerification(mail: CodeMail): void | Promise<void>;
    abstract sendPasswordReset(mail: CodeMail): void | Promise<void>;
}

/**
 * SIMULATED delivery: nothing is sent, the message is only logged. It exists so the verification and reset flows can be
 * developed and tested before a mailer is wired in. Never rely on it in production.
 */
@Injectable()
export class SimulatedAuthMailer extends AuthMailer implements OnModuleInit {
    private readonly logger = new Logger('SimulatedAuthMailer');

    constructor(private readonly app: AppConfig) {
        super();
    }

    // Production with a simulated mailer would silently drop every verification and reset e-mail: refuse to start instead.
    onModuleInit(): void {
        if (this.app.isProduction) {
            throw new Error('AuthMailer is the SIMULATED one: bind a real AuthMailer in AuthModule before running in production.');
        }
    }

    sendEmailVerification(mail: CodeMail): void {
        this.logger.log(`SIMULATED EMAIL ${JSON.stringify({ kind: 'verify_email', subject: 'Your verification code', ...mail })}`);
    }

    sendPasswordReset(mail: CodeMail): void {
        this.logger.log(`SIMULATED EMAIL ${JSON.stringify({ kind: 'reset_password', subject: 'Your password reset code', ...mail })}`);
    }
}
