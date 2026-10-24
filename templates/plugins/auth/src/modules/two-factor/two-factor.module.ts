import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserTotp } from './entities/user-totp.entity.js';
import { RecoveryCode } from './entities/recovery-code.entity.js';
import { MfaChallenge } from './entities/mfa-challenge.entity.js';
import { UserTotpService } from './services/user-totp.service.js';
import { RecoveryCodesService } from './services/recovery-codes.service.js';
import { MfaChallengesService } from './services/mfa-challenges.service.js';

// Data only: the tables behind two-factor authentication. The logic (TOTP, encryption, challenges) lives in app/auth (TwoFactorService).
@Module({
    imports:   [TypeOrmModule.forFeature([UserTotp, RecoveryCode, MfaChallenge])],
    providers: [UserTotpService, RecoveryCodesService, MfaChallengesService],
    exports:   [UserTotpService, RecoveryCodesService, MfaChallengesService],
})
export class TwoFactorModule {}
