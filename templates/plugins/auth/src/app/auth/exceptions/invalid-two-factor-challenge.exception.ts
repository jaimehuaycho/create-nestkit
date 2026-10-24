import { UnauthorizedException } from '@nestjs/common';

// One error for unknown, expired, spent and out-of-attempts challenges: nothing is revealed. The user signs in again.
export class InvalidTwoFactorChallengeException extends UnauthorizedException {
    constructor() {
        super({ message: 'The verification step expired or is no longer valid. Sign in again.', error: 'INVALID_TWO_FACTOR_CHALLENGE' });
    }
}
