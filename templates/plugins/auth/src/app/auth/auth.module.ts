import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../../modules/users/users.module.js';
import { RefreshTokensModule } from '../../modules/refresh-tokens/refresh-tokens.module.js';
import { EmailCodesModule } from '../../modules/email-codes/email-codes.module.js';
import { TwoFactorModule } from '../../modules/two-factor/two-factor.module.js';
import { AuthService } from './services/auth.service.js';
import { AuthController } from './controllers/auth.controller.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtAuthGuard, RolesGuard, TwoFactorGuard, VerifiedEmailGuard } from './guards/index.js';
import { AccountService, UserAccessService, SessionsService, EmailCodesService, TwoFactorService, AuthMailer } from './services/index.js';
import { AUTH_MAILER_PROVIDER } from './auth-mailer.provider.js';
import { JwtConfig } from './config/jwt.config.js';
import { TwoFactorConfig } from './config/two-factor.config.js';
import { TwoFactorController } from './controllers/two-factor.controller.js';

@Global()
@Module({
    imports: [
        PassportModule,
        JwtModule.registerAsync({
            // extraProviders bridges the gap between JwtModule's internal module and AuthModule's DI scope.
            extraProviders: [JwtConfig],
            inject:         [JwtConfig],
            useFactory: (cfg: JwtConfig) => ({
                secret:      cfg.secret,
                signOptions: { expiresIn: cfg.expiresIn as any, issuer: cfg.issuer, audience: cfg.audience, algorithm: 'HS256' },
                verifyOptions: { issuer: cfg.issuer, audience: cfg.audience, algorithms: ['HS256'] },
            }),
        }),
        UsersModule,
        RefreshTokensModule,
        EmailCodesModule,
        TwoFactorModule,
    ],
    providers: [
        // Global guards run in THIS order: authenticate, roles (@Roles), then verified email, then two-factor (rate limiting runs before all of them,
        // see RateLimitModule). Remove this module from AppModule to disable them all.
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: VerifiedEmailGuard },
        { provide: APP_GUARD, useClass: TwoFactorGuard },
        AuthService,
        JwtStrategy,
        JwtConfig, TwoFactorConfig,
        AccountService, UserAccessService, SessionsService, EmailCodesService, TwoFactorService,
        // Which AuthMailer sends the verification and reset codes: see auth-mailer.provider.ts.
        AUTH_MAILER_PROVIDER,
    ],
    controllers: [AuthController, TwoFactorController],
    // Global: users and roles inject UserAccessService, AccountService and the mailer without importing AuthModule (which
    // imports UsersModule: a cycle). 
    exports: [
        JwtStrategy, PassportModule, JwtConfig,
        AccountService, UserAccessService, SessionsService, EmailCodesService, TwoFactorService, AuthMailer,
    ],
})
export class AuthModule {}
