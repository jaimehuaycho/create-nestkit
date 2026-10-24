import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { MaxBytes, NormalizeEmail } from '../../../shared/decorators/index.js';
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH } from '../../../shared/security/password.util.js';

// Public sign-up. It NEVER takes a role: whoever calls it gets the default role. Choosing a role is an admin action
// (POST /users, which needs the root or admin role). Add extra profile fields (name, phone...) here.
export class RegisterDto {
    @ApiProperty({ example: 'user@email.com', maxLength: 100 })
    @NormalizeEmail()
    @IsEmail({}, { message: 'Email must be a valid email address.' })
    @MaxLength(100)
    email: string;

    @ApiProperty({ example: 'a-long-passphrase', minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_BYTES })
    @IsString()
    @IsNotEmpty({ message: 'Password is required.' })
    @MinLength(PASSWORD_MIN_LENGTH, { message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` })
    @MaxBytes(PASSWORD_MAX_BYTES, { message: `Password must not exceed ${PASSWORD_MAX_BYTES} bytes.` })
    password: string;
}
