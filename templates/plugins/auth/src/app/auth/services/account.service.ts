import { Injectable } from '@nestjs/common';
import { UsersService } from '../../../modules/users/services/users.service.js';
import { UserDto } from '../../../modules/users/dto/user.dto.js';
import { UpdateUserDto } from '../../../modules/users/dto/update-user.dto.js';
import { MutationOptions } from '../../../shared/dto/options.dto.js';
import { hashPassword } from '../../../shared/security/password.util.js';
import { EMAIL_CODES } from '../config/email-codes.config.js';
import { SessionsService } from './sessions.service.js';
import { EmailCodesService } from './email-codes.service.js';
import { AuthMailer } from './auth-mailer.service.js';
import { TwoFactorService } from './two-factor.service.js';

/**
 * Everything that changes the SECURITY state of an account: credentials, sessions, e-mail confirmation. UsersService only stores
 * plain fields; whenever a change must end sessions, invalidate links or send an e-mail, it goes through here.
 */
@Injectable()
export class AccountService {
    constructor(
        private readonly users:         UsersService,
        private readonly sessions:      SessionsService,
        private readonly emailCodes:    EmailCodesService,
        private readonly mailer:        AuthMailer,
        private readonly twoFactor:     TwoFactorService,
    ) {}

    /**
     * Updates a user and applies the security consequences: a new e-mail address (left unverified by UsersService) gets a
     * verification code. Passwords are not updated here: see replacePassword.
     */
    async updateUser<T>(returnDto: new () => T, id: number, dto: UpdateUserDto, options?: MutationOptions): Promise<T> {
        const current = await this.users.findOneById(UserDto, id);
        const result  = await this.users.update(returnDto, id, dto, options);

        if (dto.email !== undefined && dto.email !== current.email) await this.sendEmailVerification(id, dto.email);
        return result;
    }

    /** Sets a new password (after a reset link or a password change) and ends every session of the user. */
    async replacePassword(id: number, newPassword: string): Promise<void> {
        await this.users.setPasswordHash(id, await hashPassword(newPassword));
        await this.endSessionsAfterPasswordChange(id);
    }

    /** An administrator removes a user's 2FA (lost device and no recovery codes). Their sessions end: whoever holds them is not proven. */
    async resetTwoFactor(id: number): Promise<void> {
        await this.twoFactor.reset(id);
        await this.sessions.revokeAllForUser(id);
    }

    /** Marks the address as confirmed (called when its link is used). */
    async markEmailVerified(id: number): Promise<void> {
        await this.users.setEmailVerifiedAt(id, new Date());
    }

    /** Issues a verification code and "sends" it. Fire-and-forget: it must not slow the request or reveal anything by its timing. */
    async sendEmailVerification(id: number, email: string): Promise<void> {
        const code = await this.emailCodes.issue(id, 'verify_email');
        const mail = { to: email, code, expiresInMinutes: EMAIL_CODES.verifyTtlMs / 60_000 };
        setImmediate(() => void this.mailer.sendEmailVerification(mail));
    }

    /** Issues a password-reset code and sends it. */
    async sendPasswordReset(id: number, email: string): Promise<void> {
        const code = await this.emailCodes.issue(id, 'reset_password');
        await this.mailer.sendPasswordReset({ to: email, code, expiresInMinutes: EMAIL_CODES.resetTtlMs / 60_000 });
    }

    private async endSessionsAfterPasswordChange(id: number): Promise<void> {
        await this.sessions.revokeAllForUser(id);
        await this.emailCodes.invalidate(id, 'reset_password');
    }
}
