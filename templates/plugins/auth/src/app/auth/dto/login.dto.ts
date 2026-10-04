import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { MaxBytes } from '../../../shared/decorators/index.js';
import { PASSWORD_MAX_BYTES } from '../../../shared/security/password.util.js';

export class LoginDto {
    @ApiProperty({ example: 'user@email.com' })
    @IsEmail({}, { message: 'Email must be a valid email address.' })
    email: string;

    @ApiProperty({ example: 'password123' })
    @IsString()
    @IsNotEmpty({ message: 'Password is required.' })
    @MaxBytes(PASSWORD_MAX_BYTES, { message: `Password must not exceed ${PASSWORD_MAX_BYTES} bytes.` })
    password: string;
}

