import { ForbiddenException } from '@nestjs/common';

// 403 and not 401 on purpose: the user IS signed in, and a 401 makes clients try to refresh or sign out.
export class InvalidCurrentPasswordException extends ForbiddenException {
    constructor() {
        super({ message: 'The current password is not correct.', error: 'INVALID_CURRENT_PASSWORD' });
    }
}
