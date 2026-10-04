import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt, IsNotEmpty, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';
import { MaxBytes } from '../../../shared/decorators/index.js';
import { PASSWORD_MAX_BYTES } from '../../../shared/security/password.util.js';

export class CreateUserDto {
    @ApiProperty({ example: 'user@email.com', maxLength: 100 })
    @IsEmail({}, { message: 'Email must be a valid email address.' })
    @MaxLength(100, { message: 'Email must not exceed 100 characters.' })
    email: string;

    @ApiProperty({ example: 'password123', minLength: 6, maxLength: PASSWORD_MAX_BYTES })
    @IsString()
    @IsNotEmpty({ message: 'Password is required.' })
    @MinLength(6, { message: 'Password must be at least 6 characters.' })
    @MaxBytes(PASSWORD_MAX_BYTES, { message: `Password must not exceed ${PASSWORD_MAX_BYTES} bytes.` })
    password: string;

    @ApiProperty({ example: 3, description: 'Role ID (must exist in the roles table)' })
    @IsInt({ message: 'Role ID must be an integer.' })
    @IsPositive({ message: 'Role ID must be a positive number.' })
    roleId: number;
}
