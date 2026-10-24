import { RoleEnum } from '../../../shared/enums/index.js';
import { ApiProperty } from '@nestjs/swagger';
import { DtoField } from '../../../shared/orm/index.js';

export class RoleDto {
    @DtoField()
    @ApiProperty({ example: RoleEnum.ADMIN, description: 'Stable identifier of the role.' })
    name!: string;

    @DtoField()
    @ApiProperty({ example: 'Manages users', nullable: true, type: String })
    description!: string | null;

    @DtoField()
    @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
    createdAt!: Date;
}
