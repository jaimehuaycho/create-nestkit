import { ApiHideProperty } from '@nestjs/swagger';
import { DtoField } from '../../../shared/orm/index.js';

/**
 * Internal DTO for auth operations.
 * Includes sensitive fields (password, refreshToken) required for credential
 * verification and token rotation. Never use in HTTP responses.
 */
export class UserForAuthDto {
    @DtoField() id!: number;
    @DtoField() email!: string;
    @DtoField() roleId!: number;

    @ApiHideProperty()
    @DtoField()
    password!: string;

    @ApiHideProperty()
    @DtoField()
    refreshToken!: string | null;
}
