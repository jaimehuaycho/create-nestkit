import { ConflictException } from '@nestjs/common';

export class RoleProtectedException extends ConflictException {
    constructor() {
        super({ message: 'This is a built-in role and cannot be deleted.', error: 'ROLE_PROTECTED' });
    }
}
