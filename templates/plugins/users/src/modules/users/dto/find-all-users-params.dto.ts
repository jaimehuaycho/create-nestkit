import { RoleEnum } from '../../../shared/enums/index.js';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationParamsDto } from '../../../shared/dto/index.js';

export class FindAllUsersParamsDto extends PaginationParamsDto {
    @ApiPropertyOptional({ example: RoleEnum.ADMIN, description: 'Filter by role name' })
    @IsOptional()
    @IsString()
    role?: string;
}
