import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_NAME } from '../../../config/app-name.js';
import { parseDuration } from '../../../shared/utils/duration.util.js';

@Injectable()
export class JwtConfig {
    readonly secret:            string;
    readonly expiresIn:         string;   // access token lifetime, as written in .env ('15m')
    readonly expiresInSeconds:  number;
    // `iss` (who issued the token) and `aud` (who it is for) are this application: a token minted for another app that shares
    // the secret is rejected. Fixed in code (APP_NAME), not environment variables: the secret already separates environments.
    readonly issuer             = APP_NAME;
    readonly audience           = APP_NAME;
    readonly refreshTtlMs:      number;   // life of ONE refresh token
    readonly refreshFamilyTtlMs: number;  // absolute life of a sign-in's chain of refresh tokens (rotation cannot extend it)

    constructor(cfg: ConfigService) {
        this.secret             = cfg.get<string>('JWT_SECRET')!;
        this.expiresIn          = cfg.get<string>('JWT_TIME_EXPIRE')!;
        this.expiresInSeconds   = Math.floor(parseDuration(this.expiresIn) / 1000);
        this.refreshTtlMs       = parseDuration(cfg.get<string>('REFRESH_TOKEN_TTL')!);
        this.refreshFamilyTtlMs = parseDuration(cfg.get<string>('REFRESH_FAMILY_TTL')!);
    }
}
