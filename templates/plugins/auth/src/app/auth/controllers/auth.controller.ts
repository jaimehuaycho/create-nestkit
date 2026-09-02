import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import {
    ApiTags, ApiOperation,
    ApiCreatedResponse, ApiOkResponse, ApiNoContentResponse,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service.js';
import { LoginDto } from '../dto/login.dto.js';
import { RegisterDto } from '../dto/register.dto.js';
import { RefreshDto } from '../dto/refresh.dto.js';
import { AuthResponseDto } from '../dto/auth-response.dto.js';
import { Public } from '../decorators/index.js';
import { UserUp } from '../decorators/roles.decorator.js';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator.js';
import type { AuthUser } from '../strategies/jwt.strategy.js';
import { ApiValidationError, ApiUnauthorized, ApiConflict } from '../../../shared/utils/swagger/index.js';

/**
 * Error dictionary for this module:
 *   INVALID_CREDENTIALS      401 — Email not found or password does not match.
 *   INVALID_REFRESH_TOKEN    401 — Refresh token is expired, malformed, or was already used (reuse detection).
 *   INVALID_TOKEN            401 — Access JWT is missing, malformed, or expired (guard — applies to protected routes).
 *   USER_ALREADY_EXISTS      409 — A user with the given email already exists.
 *   INSUFFICIENT_PERMISSIONS 403 — Authenticated but role does not meet the endpoint requirement.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Public()
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary:     'Login',
        description: 'Validates email and password. Returns an access token (short-lived) and a refresh token (long-lived). The generic 401 message intentionally hides whether the email exists.',
    })
    @ApiOkResponse({ type: AuthResponseDto })
    @ApiValidationError()
    async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
        return await this.authService.login(dto);
    }

    @Public()
    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary:     'Register',
        description: 'Creates a new user account and returns a ready-to-use token pair. The email must be unique across all active users.',
    })
    @ApiCreatedResponse({ type: AuthResponseDto })
    @ApiValidationError()
    @ApiConflict({ code: 'USER_ALREADY_EXISTS', message: 'A user with this email already exists.' })
    async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
        return await this.authService.register(dto);
    }

    @Public()
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary:     'Refresh tokens',
        description: 'Issues a new access + refresh token pair from the current refresh token. The previous refresh token is immediately invalidated (rotation). If a token is used twice, all sessions are revoked.',
    })
    @ApiOkResponse({ type: AuthResponseDto })
    @ApiValidationError()
    @ApiUnauthorized(
        { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token.' },
    )
    async refresh(@Body() dto: RefreshDto): Promise<AuthResponseDto> {
        return await this.authService.refresh(dto);
    }

    @UserUp()
    @Post('logout')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary:     'Logout',
        description: 'Invalidates the refresh token stored in the database. The current access token remains valid until its natural expiry — clients should discard it locally.',
    })
    @ApiNoContentResponse({ description: 'Logged out successfully.' })
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async logout(@CurrentUser() user: AuthUser): Promise<void> {
        return await this.authService.logout(user.id);
    }
}
