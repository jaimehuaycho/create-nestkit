import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { StrictRateLimit } from '../../rate-limit/rate-limit.decorator.js';
import {
    ApiTags, ApiOperation, ApiBearerAuth, ApiExtraModels, getSchemaPath,
    ApiCreatedResponse, ApiOkResponse, ApiNoContentResponse,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service.js';
import { LoginDto } from '../dto/login.dto.js';
import { RegisterDto } from '../dto/register.dto.js';
import { RefreshDto } from '../dto/refresh.dto.js';
import { AuthResponseDto } from '../dto/auth-response.dto.js';
import { TwoFactorRequiredDto } from '../dto/two-factor.dto.js';
import { Public } from '../decorators/index.js';
import { ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto } from '../dto/account.dto.js';
import { UserDto } from '../../../modules/users/dto/user.dto.js';
import { UsersService } from '../../../modules/users/services/users.service.js';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator.js';
import type { AuthUser } from '../strategies/jwt.strategy.js';
import { ApiValidationError, ApiUnauthorized, ApiConflict } from '../../../shared/utils/swagger/index.js';

/**
 * Error dictionary for this module:
 *   INVALID_CREDENTIALS      401 — Email not found or password does not match.
 *   INVALID_REFRESH_TOKEN    401 — Refresh token is unknown, expired or revoked.
 *   REFRESH_TOKEN_REUSED     401 — A rotated refresh token was presented again: that sign-in (family) is revoked.
 *   INVALID_TOKEN            401 — Access JWT is missing, malformed, expired or for another issuer/audience.
 *   USER_ALREADY_EXISTS      409 — A user with the given email already exists.
 *   TOO_MANY_REQUESTS        429 — Rate limit exceeded.
 *   INVALID_EMAIL_CODE       400 — The e-mailed code is wrong, expired, already used, replaced by a newer one or out of attempts.
 *   EMAIL_NOT_VERIFIED       403 — The route requires a verified email address.
 *   INVALID_CURRENT_PASSWORD 403 — The current password sent to change the password is wrong.
 */
@ApiTags('Auth')
@ApiExtraModels(AuthResponseDto, TwoFactorRequiredDto)
@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly usersService: UsersService,
    ) {}

    @Public()
    @StrictRateLimit()
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary:     'Login',
        description: 'Validates email and password. Starts a session on this device (its own refresh-token family): signing in elsewhere does not end it. If the user has two-factor authentication on, it answers { twoFactorRequired: true, challengeToken } instead of tokens: finish with POST /auth/2fa/verify. The generic 401 hides whether the email exists.',
    })
    @ApiOkResponse({ description: 'A session, or the second-factor challenge.', schema: { oneOf: [{ $ref: getSchemaPath(AuthResponseDto) }, { $ref: getSchemaPath(TwoFactorRequiredDto) }] } })
    @ApiValidationError()
    async login(@Body() dto: LoginDto): Promise<AuthResponseDto | TwoFactorRequiredDto> {
        return await this.authService.login(dto);
    }

    @Public()
    @StrictRateLimit()
    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary:     'Register',
        description: 'Public sign-up. Creates the account with the default role (never one chosen by the caller) and starts a session.',
    })
    @ApiCreatedResponse({ type: AuthResponseDto })
    @ApiValidationError()
    @ApiConflict({ code: 'USER_ALREADY_EXISTS', message: 'A user with this email already exists.' })
    async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
        return await this.authService.register(dto);
    }

    @Public()
    @StrictRateLimit()
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary:     'Refresh tokens',
        description: 'Exchanges a refresh token for a new access token and a new refresh token (rotation). The old one stops working. Presenting a used token again revokes that whole session.',
    })
    @ApiOkResponse({ type: AuthResponseDto })
    @ApiValidationError()
    @ApiUnauthorized(
        { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token.' },
        { code: 'REFRESH_TOKEN_REUSED',  message: 'This refresh token was already used. The session has been revoked: sign in again.' },
    )
    async refresh(@Body() dto: RefreshDto): Promise<AuthResponseDto> {
        return await this.authService.refresh(dto);
    }

    @Public()
    @Post('logout')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary:     'Logout this device',
        description: 'Revokes the session that this refresh token belongs to. Other devices stay signed in. Always 204, even for an unknown token (it does not reveal which tokens exist). The access token stays valid until it expires: discard it locally.',
    })
    @ApiNoContentResponse({ description: 'Logged out.' })
    @ApiValidationError()
    async logout(@Body() dto: RefreshDto): Promise<void> {
        return await this.authService.logout(dto);
    }

    @Post('logout-all')
    @ApiBearerAuth('access-token')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary:     'Logout every device',
        description: 'Revokes all the signed-in user\'s sessions. Requires a valid access token.',
    })
    @ApiNoContentResponse({ description: 'Logged out everywhere.' })
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async logoutAll(@CurrentUser() user: AuthUser): Promise<void> {
        return await this.authService.logoutAll(user.id);
    }

    // ── e-mail flows (6-digit codes sent by AuthMailer: SIMULATED until a real mailer is wired in) ──────────────────────────────

    @Public()
    @StrictRateLimit()
    @Post('password/forgot')
    @HttpCode(HttpStatus.ACCEPTED)
    @ApiOperation({
        summary:     'Forgot password',
        description: 'E-mails a 6-digit reset code (valid 10 minutes, single use, 5 attempts) if the address is registered. Always answers 202 with an empty body, so it cannot be used to discover which addresses exist.',
    })
    @ApiValidationError()
    forgotPassword(@Body() dto: ForgotPasswordDto): void {
        return this.authService.forgotPassword(dto);
    }

    @Public()
    @StrictRateLimit()
    @Post('password/reset')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary:     'Reset password',
        description: 'Sets a new password from the e-mail, the 6-digit code and the new password, and signs the user out of every device. An unknown address and a wrong code answer the same error.',
    })
    @ApiNoContentResponse({ description: 'Password changed.' })
    @ApiValidationError()
    async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
        return await this.authService.resetPassword(dto);
    }

    @Post('password/change')
    @StrictRateLimit()
    @ApiBearerAuth('access-token')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary:     'Change password',
        description: 'The signed-in user sets a new password. The current one is required, so a stolen access token is not enough. Every session ends (all devices) and this one gets fresh tokens in the response.',
    })
    @ApiOkResponse({ type: AuthResponseDto })
    @ApiValidationError()
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto): Promise<AuthResponseDto> {
        return await this.authService.changePassword(user.id, dto);
    }

    @Post('email/verify')
    @StrictRateLimit()
    @ApiBearerAuth('access-token')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary:     'Verify email',
        description: 'Confirms the signed-in user\'s address with the 6-digit code e-mailed to it (valid 15 minutes, single use, 5 attempts). The access token shows `email_verified: true` from the next refresh.',
    })
    @ApiNoContentResponse({ description: 'Address confirmed.' })
    @ApiValidationError()
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async verifyEmail(@CurrentUser() user: AuthUser, @Body() dto: VerifyEmailDto): Promise<void> {
        return await this.authService.verifyEmail(user.id, dto);
    }

    @Post('email/verify/request')
    @StrictRateLimit()
    @ApiBearerAuth('access-token')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary:     'Send a new verification code',
        description: 'Sends a fresh code to the signed-in user (the previous one stops working). Does nothing if the address is already verified.',
    })
    @ApiNoContentResponse({ description: 'Code sent (or already verified).' })
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async requestEmailVerification(@CurrentUser() user: AuthUser): Promise<void> {
        return await this.authService.requestEmailVerification(user.id);
    }

    @Get('me')
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Who am I', description: 'The signed-in user, read from the database (fresh role and verification state).' })
    @ApiOkResponse({ type: UserDto })
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async me(@CurrentUser() user: AuthUser): Promise<UserDto> {
        return await this.usersService.findOneById(UserDto, user.id);
    }
}

