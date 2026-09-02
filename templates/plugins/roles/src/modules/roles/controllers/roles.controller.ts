import {
    Controller, Get, Post, Put, Delete,
    Body, Param, Query, ParseIntPipe, HttpCode, HttpStatus,
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
import { AdminUp, RootOnly } from '../../../app/auth/decorators/index.js';
import { ApiNotFound, ApiUnauthorized, ApiValidationError, ApiConflict } from '../../../shared/utils/swagger/index.js';

/**
 * Error dictionary for this module:
 *   ROLE_NOT_FOUND        404 — No role with the given ID exists.
 *   ROLE_ALREADY_EXISTS   409 — A role with this name already exists.
 *   INVALID_TOKEN         401 — JWT is missing, malformed, or expired.
 *   INSUFFICIENT_PERMISSIONS 403 — Authenticated but role does not meet the endpoint requirement.
 */
@ApiTags('Roles')
@ApiBearerAuth('access-token')
@Controller('roles')
export class RolesController {
    constructor(private readonly rolesService: RolesService) {}

    @Get()
    @AdminUp()
    @ApiOperation({
        summary:     'List roles',
        description: 'Returns a paginated list of roles, searchable by name. Requires admin role or higher.',
    })
    @ApiOkResponse({ type: PaginationResponseDto })
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async findAll(@Query() params: FindAllRolesParamsDto): Promise<PaginationResponseDto<RoleDto>> {
        return await this.rolesService.findAll(RoleDto, params);
    }

    @Get(':id')
    @AdminUp()
    @ApiOperation({
        summary:     'Get a role by ID',
        description: 'Returns a single role by its numeric ID. Requires admin role or higher.',
    })
    @ApiOkResponse({ type: RoleDto })
    @ApiNotFound({ code: 'ROLE_NOT_FOUND', message: 'Role not found.' })
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async findOne(@Param('id', ParseIntPipe) id: number): Promise<RoleDto> {
        return await this.rolesService.findOneById(RoleDto, id);
    }

    @Post()
    @AdminUp()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary:     'Create a role',
        description: 'Creates a new role. The name must be unique.',
    })
    @ApiCreatedResponse({ type: RoleDto })
    @ApiValidationError()
    @ApiConflict({ code: 'ROLE_ALREADY_EXISTS', message: 'A role with this name already exists.' })
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async create(@Body() dto: CreateRoleDto): Promise<RoleDto> {
        return await this.rolesService.create(RoleDto, dto);
    }

    @Put(':id')
    @AdminUp()
    @ApiOperation({
        summary:     'Update a role',
        description: 'Updates the role name. The new name must not be taken by another role.',
    })
    @ApiOkResponse({ type: RoleDto })
    @ApiValidationError()
    @ApiNotFound({ code: 'ROLE_NOT_FOUND', message: 'Role not found.' })
    @ApiConflict({ code: 'ROLE_ALREADY_EXISTS', message: 'A role with this name already exists.' })
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateRoleDto,
    ): Promise<RoleDto> {
        return await this.rolesService.update(RoleDto, id, dto);
    }

    @Delete(':id')
    @RootOnly()
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary:     'Delete a role',
        description: 'Permanently deletes a role. Requires root. Ensure no users have this role assigned before deleting.',
    })
    @ApiNoContentResponse({ description: 'Role deleted successfully.' })
    @ApiNotFound({ code: 'ROLE_NOT_FOUND', message: 'Role not found.' })
    @ApiUnauthorized({ code: 'INVALID_TOKEN', message: 'Invalid or expired token.' })
    async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
        return await this.rolesService.remove(id);
    }
}
