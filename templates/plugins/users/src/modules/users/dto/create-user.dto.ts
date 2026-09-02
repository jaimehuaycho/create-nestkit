import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt, IsNotEmpty, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
    @ApiProperty({ example: 'user@email.com', maxLength: 100 })
    @IsEmail({}, { message: 'Email must be a valid email address.' })
    @MaxLength(100, { message: 'Email must not exceed 100 characters.' })
    email: string;

    @ApiProperty({ example: 'password123', minLength: 6, maxLength: 255 })
    @IsString()
    @IsNotEmpty({ message: 'Password is required.' })
    @MinLength(6, { message: 'Password must be at least 6 characters.' })
    @MaxLength(255)
    password: string;

    @ApiProperty({ example: 3, description: 'Role ID (must exist in the roles table)' })
    @IsInt({ message: 'Role ID must be an integer.' })
    @IsPositive({ message: 'Role ID must be a positive number.' })
    roleId: number;
}
