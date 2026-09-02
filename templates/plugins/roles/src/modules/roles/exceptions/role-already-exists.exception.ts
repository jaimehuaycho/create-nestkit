import { ConflictException } from '@nestjs/common';

export class RoleAlreadyExistsException extends ConflictException {
    constructor() {
        super({ message: 'A role with this name already exists.', error: 'ROLE_ALREADY_EXISTS' });
    }
}
