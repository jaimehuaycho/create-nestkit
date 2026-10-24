import { ForbiddenException } from '@nestjs/common';

export class EmailNotVerifiedException extends ForbiddenException {
    constructor() {
        super({ message: 'You must verify your email address to do this.', error: 'EMAIL_NOT_VERIFIED' });
    }
}
