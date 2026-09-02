import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsInt, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto {
    @ApiPropertyOptional({ example: 'new@email.com', maxLength: 100 })
    @IsOptional()
    @IsEmail({}, { message: 'Email must be a valid email address.' })
    @MaxLength(100)
    email?: string;

    @ApiPropertyOptional({ example: 'newpassword123', minLength: 6 })
    @IsOptional()
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters.' })
    @MaxLength(255)
    password?: string;

    @ApiPropertyOptional({ example: 2, description: 'Role ID (must exist in the roles table)' })
    @IsOptional()
    @IsInt({ message: 'Role ID must be an integer.' })
    @IsPositive({ message: 'Role ID must be a positive number.' })
    roleId?: number;
}
