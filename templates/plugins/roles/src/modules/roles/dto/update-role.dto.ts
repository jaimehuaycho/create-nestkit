import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

// Only the description can change: the name is the role's identity (tokens, @Roles() and users refer to it).
export class UpdateRoleDto {
    @ApiPropertyOptional({ example: 'Handles customer requests', maxLength: 255 })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    description?: string;
}
