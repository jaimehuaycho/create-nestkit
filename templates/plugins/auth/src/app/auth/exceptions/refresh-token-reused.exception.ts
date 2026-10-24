import { UnauthorizedException } from '@nestjs/common';

// A refresh token that was already rotated came back: two parties hold it. Its whole sign-in (the family) is revoked.
export class RefreshTokenReusedException extends UnauthorizedException {
    constructor() {
        super({ message: 'This refresh token was already used. The session has been revoked: sign in again.', error: 'REFRESH_TOKEN_REUSED' });
    }
}
