import { ConflictException, ForbiddenException } from '@nestjs/common';

export class TwoFactorAlreadyEnabledException extends ConflictException {
    constructor() {
        super({ message: 'Two-factor authentication is already enabled.', error: 'TWO_FACTOR_ALREADY_ENABLED' });
    }
}

export class TwoFactorNotEnabledException extends ConflictException {
    constructor() {
        super({ message: 'Two-factor authentication is not enabled.', error: 'TWO_FACTOR_NOT_ENABLED' });
    }
}

export class TwoFactorSetupNotStartedException extends ConflictException {
    constructor() {
        super({ message: 'Start the setup first (POST /auth/2fa/setup).', error: 'TWO_FACTOR_SETUP_NOT_STARTED' });
    }
}

export class TwoFactorRequiredException extends ForbiddenException {
    constructor() {
        super({ message: 'This action requires two-factor authentication: sign in with a code from your authenticator app.', error: 'TWO_FACTOR_REQUIRED' });
    }
}
