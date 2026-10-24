import { SetMetadata, applyDecorators } from '@nestjs/common';
import { ApiForbiddenResponse } from '@nestjs/swagger';
import { RoleEnum } from '../../../shared/enums/index.js';
import { errorBody } from '../../../shared/utils/swagger/index.js';

export const ROLES_KEY = 'authorization:roles';

/**
 * Lists the roles allowed to call a route (or every route of a controller). The user needs AT LEAST ONE of them; the list is explicit, there
 * is no hierarchy, so "admin" does not silently include what "user" can do. A route without @Roles() is open to any signed-in user.
 *
 *   @Roles(RoleEnum.ROOT, RoleEnum.ADMIN)
 *   @Get()
 *   findAll() { ... }
 *
 * Rules that depend on the record (only your own, only users below you) are not expressed here: see UserAccessService.
 */
export const Roles = (...roles: RoleEnum[]) =>
    applyDecorators(
        SetMetadata(ROLES_KEY, roles),
        ApiForbiddenResponse({
            description: `Allowed roles: ${roles.join(', ')}.`,
            schema: { example: errorBody(403, 'INSUFFICIENT_PERMISSIONS', 'You do not have permission to do this.') },
        }),
    );
