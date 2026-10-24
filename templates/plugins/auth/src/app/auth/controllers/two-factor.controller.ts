import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiNoContentResponse } from '@nestjs/swagger';
import { StrictRateLimit } from '../../rate-limit/rate-limit.decorator.js';
import { AuthService } from '../services/auth.service.js';
import { TwoFactorService } from '../services/two-factor.service.js';
import { AuthResponseDto } from '../dto/auth-response.dto.js';
import {
    RecoveryCodesDto, TwoFactorCodeDto, TwoFactorDisableDto, TwoFactorPasswordDto,
    TwoFactorSetupResponseDto, TwoFactorStatusDto, TwoFactorVerifyDto,
} from '../dto/two-factor.dto.js';
import { Public } from '../decorators/index.js';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator.js';
import type { AuthUser } from '../strategies/jwt.strategy.js';
import { ApiValidationError, ApiUnauthorized } from '../../../shared/utils/swagger/index.js';

/**
 * Two-factor authentication with an authenticator app (TOTP).
 *   INVALID_TWO_FACTOR_CHALLENGE  401 — The challenge is unknown, expired, spent or out of attempts: sign in again.
 *   INVALID_TWO_FACTOR_CODE       401 while signing in, 403 when managing 2FA — The code is wrong, or a recovery code was already used.
 *   TWO_FACTOR_ALREADY_ENABLED    409 · TWO_FACTOR_NOT_ENABLED 409 · TWO_FACTOR_SETUP_NOT_STARTED 409
 *   INVALID_CURRENT_PASSWORD      403 — The password sent to confirm the action is wrong.
 */
@ApiTags('Two-factor')
@Controller('auth/2fa')
export class TwoFactorController {
    constructor(
        private readonly authService:   AuthService,
        private readonly twoFactor:     TwoFactorService,
    ) {}

    @Public()
    @StrictRateLimit()
    @Post('verify')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary:     'Finish a sign-in with a code',
        description: 'Second step of POST /auth/login for a user with 2FA: the challengeToken plus a 6-digit code (or a recovery code). The challenge lasts 5 minutes and allows 5 attempts. Opens the session; its access token carries amr ["pwd","otp"].',
    })
    @ApiOkResponse({ type: AuthResponseDto })
    @ApiValidationError()
    async verify(@Body() dto: TwoFactorVerifyDto): Promise<AuthResponseDto> {
        return await this.authService.verifyTwoFactor(dto);
    }

    @Get()
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Two-factor status', description: 'Whether 2FA is on and how many recovery codes are left.' })
    @ApiOkResponse({ type: TwoFactorStatusDto })
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async status(@CurrentUser() user: AuthUser): Promise<TwoFactorStatusDto> {
        return await this.twoFactor.status(user.id);
    }

    @Post('setup')
    @StrictRateLimit()
    @ApiBearerAuth('access-token')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary:     'Start the setup',
        description: 'Needs the current password. Returns the secret and the otpauth URL (render it as a QR). It is NOT active until POST /auth/2fa/enable proves it with a code. Calling it again starts over.',
    })
    @ApiOkResponse({ type: TwoFactorSetupResponseDto })
    @ApiValidationError()
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async setup(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorPasswordDto): Promise<TwoFactorSetupResponseDto> {
        return await this.authService.setupTwoFactor(user.id, dto);
    }

    @Post('enable')
    @StrictRateLimit()
    @ApiBearerAuth('access-token')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary:     'Turn it on',
        description: 'Confirms the setup with the first code from the app and returns 10 recovery codes. They are shown only this once.',
    })
    @ApiOkResponse({ type: RecoveryCodesDto })
    @ApiValidationError()
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async enable(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorCodeDto): Promise<RecoveryCodesDto> {
        return { recoveryCodes: await this.twoFactor.enable(user.id, dto.code) };
    }

    @Post('recovery-codes')
    @StrictRateLimit()
    @ApiBearerAuth('access-token')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'New recovery codes', description: 'Needs a valid code. Replaces the whole set: the old codes stop working.' })
    @ApiOkResponse({ type: RecoveryCodesDto })
    @ApiValidationError()
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async recoveryCodes(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorCodeDto): Promise<RecoveryCodesDto> {
        return { recoveryCodes: await this.twoFactor.regenerateRecoveryCodes(user.id, dto.code) };
    }

    @Post('disable')
    @StrictRateLimit()
    @ApiBearerAuth('access-token')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Turn it off', description: 'Needs the current password AND a valid code.' })
    @ApiNoContentResponse({ description: 'Two-factor authentication is off.' })
    @ApiValidationError()
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async disable(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorDisableDto): Promise<void> {
        return await this.authService.disableTwoFactor(user.id, dto);
    }
}
