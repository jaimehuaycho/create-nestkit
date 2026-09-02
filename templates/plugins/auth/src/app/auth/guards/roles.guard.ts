import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthUser } from '../strategies/jwt.strategy.js';
import { InsufficientPermissionsException } from '../exceptions/index.js';

// Role hierarchy: lower number = more privileges. (1=root, 2=admin, 3=user)
// RolesGuard checks: user.roleId <= requiredRole
@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const requiredRol = this.reflector.getAllAndOverride<number>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (requiredRol === undefined) return true;

        const { user }: { user: AuthUser } = context.switchToHttp().getRequest();

        // @Public() routes bypass JwtAuthGuard so user may be undefined here.
        if (!user) return true;

        if (user.roleId <= requiredRol) return true;

        throw new InsufficientPermissionsException();
    }
}
