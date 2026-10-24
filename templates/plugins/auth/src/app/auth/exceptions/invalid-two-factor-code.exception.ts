import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

// While signing in (nobody is signed in yet) a wrong code is a 401; for a signed-in user managing their 2FA it is a 403, so clients do
// not treat it as an expired session. Same error code either way.
export class InvalidTwoFactorCodeException extends UnauthorizedException {
    constructor() {
        super({ message: 'The code is not valid.', error: 'INVALID_TWO_FACTOR_CODE' });
    }
}

export class InvalidTwoFactorCodeForbiddenException extends ForbiddenException {
    constructor() {
        super({ message: 'The code is not valid.', error: 'INVALID_TWO_FACTOR_CODE' });
    }
}
