import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateRoleDto {
    @ApiProperty({ example: 'support', maxLength: 50, description: 'Lowercase identifier: letters, digits, "_" or "-", starting with a letter. It cannot be changed later.' })
    @IsString()
    @MaxLength(50, { message: 'Name must not exceed 50 characters.' })
    @Matches(/^[a-z][a-z0-9_-]*$/, { message: 'Name must be lowercase, start with a letter and use only letters, digits, "_" or "-".' })
    name: string;

    @ApiPropertyOptional({ example: 'Handles customer requests', maxLength: 255 })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    description?: string;
}
