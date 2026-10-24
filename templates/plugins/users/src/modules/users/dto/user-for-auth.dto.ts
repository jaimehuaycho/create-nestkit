import { ApiHideProperty } from '@nestjs/swagger';
import { DtoField, DtoRelation } from '../../../shared/orm/index.js';
import { RoleDto } from '../../roles/dto/role.dto.js';

/**
 * Internal DTO for auth operations: includes the password hash needed to verify credentials.
 * Never use in HTTP responses.
 */
export class UserForAuthDto {
    @DtoField() id!: number;
    @DtoField() email!: string;
    @DtoField() emailVerifiedAt!: Date | null;

    @DtoRelation(() => RoleDto)
    role!: RoleDto;

    @ApiHideProperty()
    @DtoField()
    password!: string;
}
