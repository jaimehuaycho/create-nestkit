import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { MaxBytes, NormalizeEmail, StripSpaces } from '../../../shared/decorators/index.js';
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH } from '../../../shared/security/password.util.js';

export class ForgotPasswordDto {
    @ApiProperty({ example: 'user@email.com', maxLength: 100 })
    @NormalizeEmail()
    @IsEmail({}, { message: 'Email must be a valid email address.' })
    @MaxLength(100)
    email: string;
}

// The 6 digits e-mailed to the user (spaces typed by a person are ignored).
const CODE_DOC = 'The 6-digit code from the e-mail.';

export class ResetPasswordDto {
    @ApiProperty({ example: 'user@email.com', maxLength: 100 })
    @NormalizeEmail()
    @IsEmail({}, { message: 'Email must be a valid email address.' })
    @MaxLength(100)
    email: string;

    @ApiProperty({ example: '482913', description: CODE_DOC })
    @StripSpaces()
    @Matches(/^\d{6}$/, { message: 'The code must be 6 digits.' })
    code: string;

    @ApiProperty({ example: 'a-new-long-passphrase', minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_BYTES })
    @IsString()
    @MinLength(PASSWORD_MIN_LENGTH, { message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` })
    @MaxBytes(PASSWORD_MAX_BYTES, { message: `Password must not exceed ${PASSWORD_MAX_BYTES} bytes.` })
    password: string;
}

export class VerifyEmailDto {
    @ApiProperty({ example: '482913', description: CODE_DOC })
    @StripSpaces()
    @Matches(/^\d{6}$/, { message: 'The code must be 6 digits.' })
    code: string;
}

export class ChangePasswordDto {
    @ApiProperty({ example: 'the-password-you-use-today', description: 'The password the user signs in with now.' })
    @IsString()
    @IsNotEmpty({ message: 'The current password is required.' })
    @MaxBytes(PASSWORD_MAX_BYTES, { message: `Password must not exceed ${PASSWORD_MAX_BYTES} bytes.` })
    currentPassword: string;

    @ApiProperty({ example: 'a-new-long-passphrase', minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_BYTES })
    @IsString()
    @MinLength(PASSWORD_MIN_LENGTH, { message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` })
    @MaxBytes(PASSWORD_MAX_BYTES, { message: `Password must not exceed ${PASSWORD_MAX_BYTES} bytes.` })
    newPassword: string;
}
