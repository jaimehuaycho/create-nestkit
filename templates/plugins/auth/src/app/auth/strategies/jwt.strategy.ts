import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtConfig } from '../config/jwt.config.js';

// Claims we put in the access token. Keep it minimal: it travels with every request and goes stale until it expires.
// `roles` is a list of role NAMES (RFC 9068 / RFC 7643 claim name). iss, aud, jti, iat and exp are added when signing.
export interface JwtPayload {
    sub:            number;     // user id
    roles:          string[];
    email_verified: boolean;    // standard OIDC claim: has the user confirmed their address?
    amr:            string[];   // standard claim (RFC 8176): how the session was opened. 'pwd' = password, 'otp' = also a one-time code.
}

// Shape of request.user after validate() runs. Accessed via @CurrentUser().
export interface AuthUser {
    id:            number;
    roles:         string[];
    emailVerified: boolean;
    twoFactor:     boolean;     // the session was opened with a second factor (amr contains 'otp')
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(jwtConfig: JwtConfig) {
        super({
            jwtFromRequest:   ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey:      jwtConfig.secret,
            issuer:           jwtConfig.issuer,      // a token from another issuer or for another audience is rejected
            audience:         jwtConfig.audience,
            algorithms:       ['HS256'],
        });
    }

    // payload is already verified by passport-jwt — no DB lookup needed here by default.
    validate(payload: JwtPayload): AuthUser {
        return {
            id:            payload.sub,
            roles:         payload.roles ?? [],
            emailVerified: payload.email_verified === true,
            twoFactor:     Array.isArray(payload.amr) && payload.amr.includes('otp'),
        };
    }
}
