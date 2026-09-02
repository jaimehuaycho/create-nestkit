import { ApiProperty } from '@nestjs/swagger';
import { DtoField, DtoRelation } from '../../../shared/orm/index.js';
import { RoleDto } from '../../roles/dto/role.dto.js';

export class UserDto {
    @DtoField()
    @ApiProperty({ example: 1 })
    id!: number;

    @DtoField()
    @ApiProperty({ example: 'user@email.com' })
    email!: string;

    @DtoRelation(() => RoleDto)
    @ApiProperty({ type: () => RoleDto })
    role!: RoleDto;

    @DtoField()
    @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
    createdAt!: Date;
}
