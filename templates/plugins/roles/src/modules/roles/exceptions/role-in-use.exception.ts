import { ConflictException } from '@nestjs/common';

export class RoleInUseException extends ConflictException {
    constructor() {
        super({ message: 'Users still have this role. Move them to another role first.', error: 'ROLE_IN_USE' });
    }
}
