import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../../modules/users/services/users.service.js';
import { UserDto } from '../../../modules/users/dto/user.dto.js';
import { UserForAuthDto } from '../../../modules/users/dto/user-for-auth.dto.js';
import { JwtConfig } from '../config/jwt.config.js';
import { LoginDto } from '../dto/login.dto.js';
import { RegisterDto } from '../dto/register.dto.js';
import { RefreshDto } from '../dto/refresh.dto.js';
import { AuthResponseDto } from '../dto/auth-response.dto.js';
import { JwtPayload } from '../strategies/jwt.strategy.js';
import { InvalidCredentialsException, InvalidCurrentPasswordException, InvalidEmailCodeException, InvalidRefreshTokenException } from '../exceptions/index.js';
import { comparePassword, hashPassword, needsRehash } from '../../../shared/security/password.util.js';
import { SessionsService } from './sessions.service.js';
import { EmailCodesService } from './email-codes.service.js';
import { AccountService } from './account.service.js';
import { TwoFactorService } from './two-factor.service.js';
import { ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto } from '../dto/account.dto.js';
import { TwoFactorDisableDto, TwoFactorPasswordDto, TwoFactorRequiredDto, TwoFactorSetupResponseDto, TwoFactorVerifyDto } from '../dto/two-factor.dto.js';
import { Logger } from '@nestjs/common';
import { DEFAULT_ROLE } from '../../../modules/roles/roles.constants.js';

@Injectable()
export class AuthService {
    private dummyHash?: Promise<string>;

    constructor(
        private readonly usersService:   UsersService,
        private readonly jwtService:     JwtService,
        private readonly jwtConfig:      JwtConfig,
        private readonly sessions:       SessionsService,
        private readonly emailCodes:     EmailCodesService,
        private readonly account:        AccountService,
        private readonly twoFactor:      TwoFactorService,
    ) {}

    private readonly logger = new Logger(AuthService.name);

    /**
     * With 2FA off this opens the session. With 2FA on, the right password is only the FIRST step: it answers with a short-lived
     * challenge and no tokens, and POST /auth/2fa/verify finishes the sign-in.
     */
    async login(dto: LoginDto): Promise<AuthResponseDto | TwoFactorRequiredDto> {
        const user = await this.usersService.findOneByEmail(UserForAuthDto, dto.email, { throwException: false });

        // Always verify against a hash, even for an unknown email: otherwise a missing account answers faster than a wrong
        // password and the response time reveals which emails are registered.
        const matches = await comparePassword(dto.password, user?.password ?? await this.getDummyHash());
        if (!user || !matches) throw new InvalidCredentialsException();

        // The password was just proven right and we hold the plaintext: upgrade a hash made with a weaker cost.
        if (needsRehash(user.password)) await this.usersService.setPasswordHash(user.id, await hashPassword(dto.password));

        if (await this.twoFactor.isEnabled(user.id)) {
            return { twoFactorRequired: true, ...(await this.twoFactor.createChallenge(user.id)) };
        }
        return await this.startSession(user.id);
    }

    /** Second step of a sign-in with 2FA: the challenge from login plus a code (authenticator or recovery). */
    async verifyTwoFactor(dto: TwoFactorVerifyDto): Promise<AuthResponseDto> {
        const userId = await this.twoFactor.completeChallenge(dto.challengeToken, dto.code);
        return await this.startSession(userId, true);
    }

    async register(dto: RegisterDto): Promise<AuthResponseDto> {
        const userDto = await this.usersService.create(UserDto, { email: dto.email, password: dto.password, role: DEFAULT_ROLE });
        await this.account.sendEmailVerification(userDto.id, userDto.email);
        return await this.startSession(userDto.id);
    }

    async refresh(dto: RefreshDto): Promise<AuthResponseDto> {
        const { userId, refreshToken, twoFactor } = await this.sessions.rotate(dto.refreshToken);

        // Read the roles again: a role change takes effect at the next refresh, not only at the next login.
        const user = await this.usersService.findOneById(UserDto, userId, { throwException: false });
        if (!user) {
            await this.sessions.revokeAllForUser(userId);
            throw new InvalidRefreshTokenException();
        }
        return await this.buildResponse(user, refreshToken, twoFactor);
    }

    /** Signs out ONE device. */
    async logout(dto: RefreshDto): Promise<void> {
        await this.sessions.revokeByToken(dto.refreshToken);
    }

    /** Signs out every device. */
    async logoutAll(userId: number): Promise<void> {
        await this.sessions.revokeAllForUser(userId);
    }

    // ── e-mail flows ──────────────────────────────────────────────────────────

    /** Confirms the signed-in user's address with the code e-mailed to it. The next refresh puts `email_verified: true` in the access token. */
    async verifyEmail(userId: number, dto: VerifyEmailDto): Promise<void> {
        await this.emailCodes.consume(userId, 'verify_email', dto.code);
        await this.account.markEmailVerified(userId);
    }

    /** Sends a new verification code to the signed-in user (no-op when the address is already verified). */
    async requestEmailVerification(userId: number): Promise<void> {
        const user = await this.usersService.findOneById(UserDto, userId);
        if (user.emailVerifiedAt) return;
        await this.account.sendEmailVerification(user.id, user.email);
    }

    /**
     * Starts a password reset. It answers the same whether or not the address exists, and does the work AFTER answering, so neither
     * the body nor the response time reveals which addresses are registered.
     */
    forgotPassword(dto: ForgotPasswordDto): void {
        setImmediate(async () => {
            try {
                const user = await this.usersService.findOneByEmail(UserDto, dto.email, { throwException: false });
                if (!user) return;
                await this.account.sendPasswordReset(user.id, user.email);
            } catch (err) {
                this.logger.error('Password reset could not be started', err instanceof Error ? err.stack : String(err));
            }
        });
    }

    /**
     * Sets a new password from the e-mailed code and ends every session of the user. The code works once, for 10 minutes and 5 attempts.
     * An address that is not registered gets the same error as a wrong code.
     */
    async resetPassword(dto: ResetPasswordDto): Promise<void> {
        const user = await this.usersService.findOneByEmail(UserDto, dto.email, { throwException: false });
        if (!user) {
            this.emailCodes.spendTimeLikeAConsume('reset_password', dto.code);
            throw new InvalidEmailCodeException();
        }
        await this.emailCodes.consume(user.id, 'reset_password', dto.code);
        await this.account.replacePassword(user.id, dto.password);
    }

    /**
     * A signed-in user changes their password. The CURRENT password is required: a stolen access token alone must not be enough to
     * take the account over. Every session ends (other devices, and any thief) and this device gets a fresh one.
     */
    async changePassword(userId: number, dto: ChangePasswordDto): Promise<AuthResponseDto> {
        await this.assertCurrentPassword(userId, dto.currentPassword);

        await this.account.replacePassword(userId, dto.newPassword);
        return await this.startSession(userId);
    }

    // ── two-factor management (needs the password again: a stolen access token alone must not weaken the account) ──────────

    async setupTwoFactor(userId: number, dto: TwoFactorPasswordDto): Promise<TwoFactorSetupResponseDto> {
        await this.assertCurrentPassword(userId, dto.currentPassword);
        const user = await this.usersService.findOneById(UserDto, userId);
        return await this.twoFactor.setup(userId, user.email);
    }

    async disableTwoFactor(userId: number, dto: TwoFactorDisableDto): Promise<void> {
        await this.assertCurrentPassword(userId, dto.currentPassword);
        await this.twoFactor.disable(userId, dto.code);
    }

    // ── internals ─────────────────────────────────────────────────────────────

    private async assertCurrentPassword(userId: number, password: string): Promise<void> {
        const user = await this.usersService.findOneById(UserForAuthDto, userId);
        if (!(await comparePassword(password, user.password))) throw new InvalidCurrentPasswordException();
    }

    private async startSession(userId: number, twoFactor = false): Promise<AuthResponseDto> {
        const user         = await this.usersService.findOneById(UserDto, userId);
        const refreshToken = await this.sessions.issue(userId, twoFactor);
        return await this.buildResponse(user, refreshToken, twoFactor);
    }

    private async buildResponse(user: UserDto, refreshToken: string, twoFactor: boolean): Promise<AuthResponseDto> {
        const payload: JwtPayload = {
            sub:            user.id,
            roles:          [user.role.name],
            email_verified: user.emailVerifiedAt != null,
            amr:            twoFactor ? ['pwd', 'otp'] : ['pwd'],
        };
        // iss, aud and exp come from the JwtModule options; jti makes every token unique.
        const accessToken = this.jwtService.sign(payload, { jwtid: randomUUID() });
        return { accessToken, expiresIn: this.jwtConfig.expiresInSeconds, refreshToken, user };
    }

    private getDummyHash(): Promise<string> {
        this.dummyHash ??= hashPassword(randomUUID());
        return this.dummyHash;
    }
}
