import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { MaxBytes, StripSpaces } from '../../../shared/decorators/index.js';
import { PASSWORD_MAX_BYTES } from '../../../shared/security/password.util.js';

const CODE_DOC = 'A 6-digit code from the authenticator app, or one recovery code (abcde-fghij).';

export class TwoFactorPasswordDto {
    @ApiProperty({ example: 'the-password-you-use-today' })
    @IsString()
    @IsNotEmpty({ message: 'The current password is required.' })
    @MaxBytes(PASSWORD_MAX_BYTES, { message: `Password must not exceed ${PASSWORD_MAX_BYTES} bytes.` })
    currentPassword: string;
}

export class TwoFactorCodeDto {
    @ApiProperty({ example: '123456', description: CODE_DOC })
    @StripSpaces()
    @IsString()
    @Length(6, 20, { message: 'The code must be 6 digits (or a recovery code).' })
    code: string;
}

export class TwoFactorDisableDto extends TwoFactorPasswordDto {
    @ApiProperty({ example: '123456', description: CODE_DOC })
    @StripSpaces()
    @IsString()
    @Length(6, 20, { message: 'The code must be 6 digits (or a recovery code).' })
    code: string;
}

export class TwoFactorVerifyDto extends TwoFactorCodeDto {
    @ApiProperty({ example: 'q3Zx0e9y5pQ2m8Jt1VbN7aLkR4sWcU6hDfGiOeXnYzA', description: 'The challengeToken returned by POST /auth/login.' })
    @IsString()
    @IsNotEmpty()
    challengeToken: string;
}

export class TwoFactorSetupResponseDto {
    @ApiProperty({ example: 'JBSWY3DPEHPK3PXP', description: 'The secret, for typing it into the authenticator by hand.' })
    secret: string;

    @ApiProperty({ example: 'otpauth://totp/auth-ours:user%40mail.com?secret=JBSWY3DPEHPK3PXP&issuer=auth-ours', description: 'Render this as a QR code. Not active until POST /auth/2fa/enable.' })
    otpauthUrl: string;
}

export class RecoveryCodesDto {
    @ApiProperty({ type: [String], example: ['abcde-fghij'], description: 'Single-use codes for when the authenticator is lost. Shown ONLY this once: the user must store them.' })
    recoveryCodes: string[];
}

export class TwoFactorStatusDto {
    @ApiProperty() enabled: boolean;
    @ApiProperty({ example: 10 }) recoveryCodesLeft: number;
}

export class TwoFactorRequiredDto {
    @ApiProperty({ example: true }) twoFactorRequired: true;

    @ApiProperty({ example: 'q3Zx0e9y5pQ2m8Jt1VbN7aLkR4sWcU6hDfGiOeXnYzA', description: 'Send it with the code to POST /auth/2fa/verify. Single use, 5 attempts.' })
    challengeToken: string;

    @ApiProperty({ example: 300, description: 'Seconds the user has to enter the code.' })
    expiresIn: number;
}
