import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { InvalidTokenException } from '../exceptions/index.js';

export const IS_PUBLIC_KEY = 'isPublic';

// Registered as APP_GUARD in AuthModule — protects all routes by default.
// Decorate a handler or controller with @Public() to opt out.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private readonly reflector: Reflector) {
        super();
    }

    canActivate(context: ExecutionContext) {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) return true;

        return super.canActivate(context);
    }

    handleRequest(err: any, user: any, _info: unknown, context: ExecutionContext) {
        if (err || !user) {
            // RFC 6750 §3: a 401 for a Bearer-protected resource says which credential it expects. With a token present the
            // error is `invalid_token` (bad, expired or for another issuer or audience); without one there is nothing to describe.
            const request  = context.switchToHttp().getRequest();
            const response = context.switchToHttp().getResponse<Response>();
            const hadToken = !!request.headers?.authorization;
            response.setHeader('WWW-Authenticate', hadToken ? 'Bearer realm="api", error="invalid_token"' : 'Bearer realm="api"');
            throw new InvalidTokenException();
        }
        return user;
    }
}
