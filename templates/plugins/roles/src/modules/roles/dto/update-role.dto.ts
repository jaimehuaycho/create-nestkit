import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateRoleDto {
    @ApiPropertyOptional({ example: 'superadmin', maxLength: 50 })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    name?: string;
}
