import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EmailNotVerifiedException } from '../exceptions/index.js';
import { VERIFIED_EMAIL_KEY } from '../decorators/verified-email.decorator.js';

@Injectable()
export class VerifiedEmailGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const required = this.reflector.getAllAndOverride<boolean>(VERIFIED_EMAIL_KEY, [context.getHandler(), context.getClass()]);
        if (!required) return true;

        const user = context.switchToHttp().getRequest().user;
        if (user?.emailVerified === true) return true;
        throw new EmailNotVerifiedException();
    }
}
