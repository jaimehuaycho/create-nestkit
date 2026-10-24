import { BadRequestException } from '@nestjs/common';

// One error for wrong, expired, used, replaced, out-of-attempts and unknown-account: nothing is revealed.
export class InvalidEmailCodeException extends BadRequestException {
    constructor() {
        super({ message: 'The code is not valid or has expired. Request a new one.', error: 'INVALID_EMAIL_CODE' });
    }
}
