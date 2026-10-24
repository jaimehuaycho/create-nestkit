import {
    Controller, Get, Post, Put, Delete,
    Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
    ApiTags, ApiBearerAuth, ApiOperation,
    ApiOkResponse, ApiCreatedResponse, ApiNoContentResponse,
} from '@nestjs/swagger';
import { RolesService } from '../services/roles.service.js';
import { RoleDto } from '../dto/role.dto.js';
import { CreateRoleDto } from '../dto/create-role.dto.js';
import { UpdateRoleDto } from '../dto/update-role.dto.js';
import { FindAllRolesParamsDto } from '../dto/find-all-roles-params.dto.js';
import { PaginationResponseDto } from '../../../shared/dto/index.js';
import { Roles } from '../../../app/auth/index.js';
import { RoleEnum } from '../../../shared/enums/index.js';
import { BUILT_IN_ROLES } from '../roles.constants.js';
import { ApiNotFound, ApiValidationError, ApiConflict } from '../../../shared/utils/swagger/index.js';

/**
 * Error dictionary for this module:
 *   ROLE_NOT_FOUND            404 — No role with the given name exists.
 *   ROLE_ALREADY_EXISTS       409 — A role with this name already exists.
 *   INVALID_TOKEN             401 — JWT is missing, malformed, or expired.
 *   INSUFFICIENT_PERMISSIONS  403 — Signed in, but your role is not listed in the route's @Roles().
 */
@ApiTags('Roles')
@ApiBearerAuth('access-token')
@Controller('roles')
export class RolesController {
    constructor(private readonly rolesService: RolesService) {}

    @Get()
    @Roles(RoleEnum.ROOT, RoleEnum.ADMIN)
    @ApiOperation({ summary: 'List roles', description: `Paginated, searchable by name. Roles: ${RoleEnum.ROOT}, ${RoleEnum.ADMIN}.` })
    @ApiOkResponse({ type: PaginationResponseDto })
    async findAll(@Query() params: FindAllRolesParamsDto): Promise<PaginationResponseDto<RoleDto>> {
        return await this.rolesService.findAll(RoleDto, params);
    }

    @Get(':name')
    @Roles(RoleEnum.ROOT, RoleEnum.ADMIN)
    @ApiOperation({ summary: 'Get a role by name', description: `Roles: ${RoleEnum.ROOT}, ${RoleEnum.ADMIN}.` })
    @ApiOkResponse({ type: RoleDto })
    @ApiNotFound({ code: 'ROLE_NOT_FOUND', message: 'Role not found.' })
    async findOne(@Param('name') name: string): Promise<RoleDto> {
        return await this.rolesService.findOneByName(RoleDto, name);
    }

    @Post()
    @Roles(RoleEnum.ROOT)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a role', description: `The name is the identifier and cannot change later. Roles: ${RoleEnum.ROOT}.` })
    @ApiCreatedResponse({ type: RoleDto })
    @ApiValidationError()
    @ApiConflict({ code: 'ROLE_ALREADY_EXISTS', message: 'A role with this name already exists.' })
    async create(@Body() dto: CreateRoleDto): Promise<RoleDto> {
        return await this.rolesService.create(RoleDto, dto);
    }

    @Put(':name')
    @Roles(RoleEnum.ROOT)
    @ApiOperation({ summary: 'Update a role', description: `Only the description can change. Roles: ${RoleEnum.ROOT}.` })
    @ApiOkResponse({ type: RoleDto })
    @ApiValidationError()
    @ApiNotFound({ code: 'ROLE_NOT_FOUND', message: 'Role not found.' })
    async update(@Param('name') name: string, @Body() dto: UpdateRoleDto): Promise<RoleDto> {
        return await this.rolesService.update(RoleDto, name, dto);
    }

    @Delete(':name')
    @Roles(RoleEnum.ROOT)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a role', description: `Roles: ${RoleEnum.ROOT}. Built-in roles (${BUILT_IN_ROLES.join(', ')}) and roles that users still hold cannot be deleted.` })
    @ApiNoContentResponse({ description: 'Role deleted successfully.' })
    @ApiNotFound({ code: 'ROLE_NOT_FOUND', message: 'Role not found.' })
    @ApiConflict(
        { code: 'ROLE_PROTECTED', message: 'This is a built-in role and cannot be deleted.' },
        { code: 'ROLE_IN_USE',    message: 'Users still have this role. Move them to another role first.' },
    )
    async remove(@Param('name') name: string): Promise<void> {
        return await this.rolesService.remove(name);
    }
}
