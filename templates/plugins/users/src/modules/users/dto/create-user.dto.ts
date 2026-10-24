import { RoleEnum } from '../../../shared/enums/index.js';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { MaxBytes, NormalizeEmail } from '../../../shared/decorators/index.js';
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH } from '../../../shared/security/password.util.js';

// Creating a user with a chosen role is an ADMIN action (@Roles on POST /users and UserAccessService.assertCanAssignRole). Public sign-up is
// POST /auth/register, which never accepts a role: new accounts always get the default one.
export class CreateUserDto {
    @ApiProperty({ example: 'user@email.com', maxLength: 100 })
    @NormalizeEmail()
    @IsEmail({}, { message: 'Email must be a valid email address.' })
    @MaxLength(100, { message: 'Email must not exceed 100 characters.' })
    email: string;

    @ApiProperty({ example: 'a-long-passphrase', minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_BYTES })
    @IsString()
    @IsNotEmpty({ message: 'Password is required.' })
    @MinLength(PASSWORD_MIN_LENGTH, { message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` })
    @MaxBytes(PASSWORD_MAX_BYTES, { message: `Password must not exceed ${PASSWORD_MAX_BYTES} bytes.` })
    password: string;

    @ApiProperty({ example: RoleEnum.USER, description: 'Name of an existing role.' })
    @IsString()
    @Matches(/^[a-z][a-z0-9_-]*$/, { message: `Role must be a role name such as "${RoleEnum.USER}" or "${RoleEnum.ADMIN}".` })
    role: string;
}
