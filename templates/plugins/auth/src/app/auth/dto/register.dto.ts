import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

// Generic registration DTO. Add extra fields (name, phone, etc.) here if your project needs them.
export class RegisterDto {
    @ApiProperty({ example: 'user@email.com', maxLength: 100 })
    @IsEmail({}, { message: 'Email must be a valid email address.' })
    @MaxLength(100)
    email: string;

    @ApiProperty({ example: 'password123', minLength: 6 })
    @IsString()
    @IsNotEmpty({ message: 'Password is required.' })
    @MinLength(6, { message: 'Password must be at least 6 characters.' })
    @MaxLength(255)
    password: string;

    @ApiProperty({ example: 3, description: 'Role ID (must exist in the roles table)', type: Number })
    @IsInt({ message: 'Role ID must be an integer.' })
    roleId: number;
}
