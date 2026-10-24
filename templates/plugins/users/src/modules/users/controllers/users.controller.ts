import {
    Controller, Get, Post, Put, Delete,
    Body, Param, Query, ParseIntPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
    ApiTags, ApiBearerAuth, ApiOperation,
    ApiOkResponse, ApiCreatedResponse, ApiNoContentResponse,
} from '@nestjs/swagger';
import { UsersService } from '../services/users.service.js';
import { UserDto } from '../dto/user.dto.js';
import { CreateUserDto } from '../dto/create-user.dto.js';
import { UpdateUserDto } from '../dto/update-user.dto.js';
import { FindAllUsersParamsDto } from '../dto/find-all-users-params.dto.js';
import { PaginationResponseDto } from '../../../shared/dto/index.js';
import { ApiNotFound, ApiUnauthorized, ApiValidationError, ApiConflict } from '../../../shared/utils/swagger/index.js';
import { FindAllUsersResponseDto } from '../dto/find-all-users-response.dto.js';
import { Roles, UserAccessService, AccountService } from '../../../app/auth/index.js';
import type { AuthUser } from '../../../app/auth/strategies/jwt.strategy.js';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator.js';
import { RoleEnum } from '../../../shared/enums/index.js';

/**
 * Error dictionary for this module:
 *   USER_NOT_FOUND        404 — No user with the given ID exists or it was soft-deleted.
 *   USER_ALREADY_EXISTS   409 — A user with the given email already exists.
 *   INVALID_TOKEN         401 — JWT is missing, malformed, or expired.
 *   INSUFFICIENT_PERMISSIONS 403 — Authenticated but your role is not allowed (see the route's @Roles(), or UserAccessService).
 */
@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
    constructor(
        private readonly usersService: UsersService,
        private readonly access:        UserAccessService,
        private readonly account:       AccountService,
    ) {}

    @Get()
    @Roles(RoleEnum.ROOT, RoleEnum.ADMIN)
    @ApiOperation({
        summary:     'List users',
        description: `Returns a paginated list of users. Filterable by role name. Roles: ${RoleEnum.ROOT}, ${RoleEnum.ADMIN}.`,
    })
    @ApiOkResponse({ type: FindAllUsersResponseDto })
    @ApiUnauthorized(
        { code: 'INVALID_TOKEN',   message: 'Invalid or expired token.' },
    )
    async findAll(@Query() params: FindAllUsersParamsDto): Promise<PaginationResponseDto<UserDto>> {
        return await this.usersService.findAll(UserDto, params);
    }

    @Get(':id')
    @ApiOperation({
        summary:     'Get a user by ID',
        description: `Returns a single user. Any signed-in user for their own record; ${RoleEnum.ROOT} and ${RoleEnum.ADMIN} any record.`,
    })
    @ApiOkResponse({ type: UserDto })
    @ApiNotFound({ code: 'USER_NOT_FOUND', message: 'User not found.' })
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser): Promise<UserDto> {
        this.access.assertCanRead(user, id);
        return await this.usersService.findOneById(UserDto, id);
    }

    @Post()
    @Roles(RoleEnum.ROOT, RoleEnum.ADMIN)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary:     'Create a user',
        description: `Creates a user with a chosen role. Roles: ${RoleEnum.ROOT}, ${RoleEnum.ADMIN}. Giving a role: ${RoleEnum.ROOT} any, ${RoleEnum.ADMIN} only "${RoleEnum.USER}".`,
    })
    @ApiCreatedResponse({ type: UserDto })
    @ApiValidationError()
    @ApiConflict({ code: 'USER_ALREADY_EXISTS', message: 'A user with this email already exists.' })
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser): Promise<UserDto> {
        this.access.assertCanAssignRole(user, dto.role);
        return await this.usersService.create(UserDto, dto);
    }

    @Put(':id')
    @ApiOperation({
        summary:     'Update a user',
        description: `Partially updates a user (email, role). Any signed-in user for their own record; ${RoleEnum.ROOT} any record; ${RoleEnum.ADMIN} only "${RoleEnum.USER}" accounts. Changing the role also needs permission to give that role. Passwords change through POST /auth/password/change.`,
    })
    @ApiOkResponse({ type: UserDto })
    @ApiValidationError()
    @ApiNotFound({ code: 'USER_NOT_FOUND', message: 'User not found.' })
    @ApiConflict({ code: 'USER_ALREADY_EXISTS', message: 'A user with this email already exists.' })
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateUserDto,
        @CurrentUser() user: AuthUser,
    ): Promise<UserDto> {
        await this.access.assertCanUpdate(user, id);
        if (dto.role !== undefined) this.access.assertCanAssignRole(user, dto.role);
        return await this.account.updateUser(UserDto, id, dto);
    }

    @Delete(':id/two-factor')
    @Roles(RoleEnum.ROOT)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary:     'Remove a user\'s two-factor authentication',
        description: `For a user who lost their authenticator and their recovery codes. Roles: ${RoleEnum.ROOT}. Also ends all of the user's sessions.`,
    })
    @ApiNoContentResponse({ description: 'Two-factor authentication removed.' })
    @ApiNotFound({ code: 'USER_NOT_FOUND', message: 'User not found.' })
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async resetTwoFactor(@Param('id', ParseIntPipe) id: number): Promise<void> {
        await this.usersService.findOneById(UserDto, id);
        return await this.account.resetTwoFactor(id);
    }

    @Delete(':id')
    @Roles(RoleEnum.ROOT, RoleEnum.ADMIN)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary:     'Delete a user',
        description: `Soft-deletes the user. Roles: ${RoleEnum.ROOT}, ${RoleEnum.ADMIN}; ${RoleEnum.ROOT} any user but itself, ${RoleEnum.ADMIN} only accounts with the "${RoleEnum.USER}" role. The record is retained in the database but excluded from all queries.`,
    })
    @ApiNoContentResponse({ description: 'User deleted successfully.' })
    @ApiNotFound({ code: 'USER_NOT_FOUND', message: 'User not found.' })
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser): Promise<void> {
        await this.access.assertCanDelete(user, id);
        return await this.usersService.remove(id);
    }
}
