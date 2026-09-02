import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive } from 'class-validator';
import { PaginationParamsDto } from '../../../shared/dto/index.js';

export class FindAllUsersParamsDto extends PaginationParamsDto {
    @ApiPropertyOptional({ example: 2, description: 'Filtrar por ID de rol' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    roleId?: number;
}
