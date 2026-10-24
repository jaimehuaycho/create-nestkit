import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TwoFactorRequiredException } from '../exceptions/index.js';
import { REQUIRE_TWO_FACTOR_KEY } from '../decorators/require-two-factor.decorator.js';

@Injectable()
export class TwoFactorGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_TWO_FACTOR_KEY, [context.getHandler(), context.getClass()]);
        if (!required) return true;

        const user = context.switchToHttp().getRequest().user;
        if (user?.twoFactor === true) return true;
        throw new TwoFactorRequiredException();
    }
}
