import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InsufficientPermissionsException, InvalidTokenException } from '../exceptions/index.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { hasAnyRole } from '../utils/roles.util.js';

// Registered as APP_GUARD in AuthModule, after JwtAuthGuard (which has already put the user on the request).
@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const roles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
        if (!roles?.length) return true;

        const user = context.switchToHttp().getRequest().user ?? null;
        if (hasAnyRole(user, ...roles)) return true;

        // Nobody signed in (a @Public route that also asks for roles): 401, signing in could change the answer. Otherwise 403.
        throw user ? new InsufficientPermissionsException() : new InvalidTokenException();
    }
}
