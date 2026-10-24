import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { APP_NAME } from '../../../config/app-name.js';

@Injectable()
export class TwoFactorConfig {
    /** 32-byte key (TWO_FACTOR_ENCRYPTION_KEY, 64 hex chars): encrypts TOTP secrets at rest and keys the recovery-code hashes. */
    readonly key:          Buffer;
    /** The name an authenticator app shows next to the code. */
    readonly issuer        = APP_NAME;
    /** Time the user has to enter the code after the password was accepted. */
    readonly challengeTtlMs = 5 * 60_000;
    /** Codes that may be tried against one challenge; then the user must enter the password again. */
    readonly maxAttempts   = 5;
    readonly recoveryCodeCount = 10;

    constructor(cfg: ConfigService) {
        this.key = Buffer.from(cfg.get<string>('TWO_FACTOR_ENCRYPTION_KEY')!, 'hex');
    }
}
