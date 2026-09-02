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
import { AdminUp, RootOnly } from '../../../app/auth/decorators/index.js';

/**
 * Error dictionary for this module:
 *   USER_NOT_FOUND        404 — No user with the given ID exists or it was soft-deleted.
 *   USER_ALREADY_EXISTS   409 — A user with the given email already exists.
 *   INVALID_TOKEN         401 — JWT is missing, malformed, or expired.
 *   INSUFFICIENT_PERMISSIONS 403 — Authenticated but role does not meet the endpoint requirement.
 */
@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get()
    @AdminUp()
    @ApiOperation({
        summary:     'List users',
        description: 'Returns a paginated list of users. Filterable by roleId. Requires admin role or higher.',
    })
    @ApiOkResponse({ type: FindAllUsersResponseDto })
    @ApiUnauthorized(
        { code: 'INVALID_TOKEN',   message: 'Invalid or expired token.' },
    )
    async findAll(@Query() params: FindAllUsersParamsDto): Promise<PaginationResponseDto<UserDto>> {
        return await this.usersService.findAll(UserDto, params);
    }

    @Get(':id')
    @RootOnly()
    @ApiOperation({
        summary:     'Get a user by ID',
        description: 'Returns a single user by their numeric ID. Requires root role.',
    })
    @ApiOkResponse({ type: UserDto })
    @ApiNotFound({ code: 'USER_NOT_FOUND', message: 'User not found.' })
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async findOne(@Param('id', ParseIntPipe) id: number): Promise<UserDto> {
        return await this.usersService.findOneById(UserDto, id);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary:     'Create a user',
        description: 'Creates a new user account. Email must be unique across all active users.',
    })
    @ApiCreatedResponse({ type: UserDto })
    @ApiValidationError()
    @ApiConflict({ code: 'USER_ALREADY_EXISTS', message: 'A user with this email already exists.' })
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async create(@Body() dto: CreateUserDto): Promise<UserDto> {
        return await this.usersService.create(UserDto, dto);
    }

    @Put(':id')
    @ApiOperation({
        summary:     'Update a user',
        description: 'Partially updates a user. Only provided fields are changed. If a new email is given it must not be taken by another user.',
    })
    @ApiOkResponse({ type: UserDto })
    @ApiValidationError()
    @ApiNotFound({ code: 'USER_NOT_FOUND', message: 'User not found.' })
    @ApiConflict({ code: 'USER_ALREADY_EXISTS', message: 'A user with this email already exists.' })
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateUserDto,
    ): Promise<UserDto> {
        return await this.usersService.update(UserDto, id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary:     'Delete a user',
        description: 'Soft-deletes the user. The record is retained in the database but excluded from all queries.',
    })
    @ApiNoContentResponse({ description: 'User deleted successfully.' })
    @ApiNotFound({ code: 'USER_NOT_FOUND', message: 'User not found.' })
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
        return await this.usersService.remove(id);
    }
}
