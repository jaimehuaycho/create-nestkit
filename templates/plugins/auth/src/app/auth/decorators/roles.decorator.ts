import { SetMetadata, applyDecorators } from '@nestjs/common';
import { ApiForbiddenResponse } from '@nestjs/swagger';
import { errorBody } from '../../../shared/utils/swagger/index.js';

export const ROLES_KEY = 'required_role';

/**
 * Sets the minimum role required to access an endpoint.
 * Role hierarchy: 1=root (highest), 2=admin, 3=user (lowest).
 * RolesGuard allows access when user.roleId <= requiredRole.
 */
export const Roles = (requiredRole: number) => SetMetadata(ROLES_KEY, requiredRole);

/** Root only (role = 1). */
export const RootOnly = () =>
    applyDecorators(
        SetMetadata(ROLES_KEY, 1),
        ApiForbiddenResponse({
            description: 'Requires root role.',
            schema: { example: errorBody(403, 'INSUFFICIENT_PERMISSIONS', 'You do not have permission to perform this action.') },
        }),
    );

/** Admin or root (role ≤ 2). */
export const AdminUp = () =>
    applyDecorators(
        SetMetadata(ROLES_KEY, 2),
        ApiForbiddenResponse({
            description: 'Requires admin role or higher.',
            schema: { example: errorBody(403, 'INSUFFICIENT_PERMISSIONS', 'You do not have permission to perform this action.') },
        }),
    );

/** Any authenticated user (role ≤ 3). */
export const UserUp = () =>
    applyDecorators(
        SetMetadata(ROLES_KEY, 3),
        ApiForbiddenResponse({
            description: 'Requires user role or higher.',
            schema: { example: errorBody(403, 'INSUFFICIENT_PERMISSIONS', 'You do not have permission to perform this action.') },
        }),
    );
