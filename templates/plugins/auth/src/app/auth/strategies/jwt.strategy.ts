import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtConfig } from '../config/jwt.config.js';

// Keep the payload minimal — data here is embedded in every token and may become stale.
export interface JwtPayload {
    sub:    number; // user id
    email:  string;
    roleId: number;
}

// Shape of request.user after validate() runs. Accessed via @CurrentUser().
export interface AuthUser {
    id:     number;
    email:  string;
    roleId: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(jwtConfig: JwtConfig) {
        super({
            jwtFromRequest:   ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey:      jwtConfig.secret,
        });
    }

    // payload is already verified by passport-jwt — no DB lookup needed here by default.
    validate(payload: JwtPayload): AuthUser {
        return {
            id:     payload.sub,
            email:  payload.email,
            roleId: payload.roleId,
        };
    }
}
