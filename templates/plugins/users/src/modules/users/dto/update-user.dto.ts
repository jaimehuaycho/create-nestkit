import { RoleEnum } from '../../../shared/enums/index.js';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { NormalizeEmail } from '../../../shared/decorators/index.js';

export class UpdateUserDto {
    @ApiPropertyOptional({ example: 'new@email.com', maxLength: 100 })
    @IsOptional()
    @NormalizeEmail()
    @IsEmail({}, { message: 'Email must be a valid email address.' })
    @MaxLength(100)
    email?: string;

    // Changing a role needs permission to give it (UserAccessService.assertCanAssignRole): a user can edit their own email, never their role. Passwords are not edited here: POST /auth/password/change.
    @ApiPropertyOptional({ example: RoleEnum.ADMIN, description: 'Name of an existing role. Requires permission to assign it.' })
    @IsOptional()
    @IsString()
    @Matches(/^[a-z][a-z0-9_-]*$/, { message: `Role must be a role name such as "${RoleEnum.USER}" or "${RoleEnum.ADMIN}".` })
    role?: string;
}
