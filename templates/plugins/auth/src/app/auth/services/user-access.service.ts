import { Injectable } from '@nestjs/common';
import { UsersService } from '../../../modules/users/services/users.service.js';
import { UserDto } from '../../../modules/users/dto/user.dto.js';
import { RoleEnum } from '../../../shared/enums/index.js';
import { InsufficientPermissionsException } from '../exceptions/index.js';
import { hasAnyRole, type AuthorizedUser } from '../utils/roles.util.js';

/**
 * The access rules that @Roles() cannot express because they depend on WHICH record is touched. Everything else is a plain @Roles() on the
 * route. Each method throws 403 when the rule is not met:
 *   - a user reads and edits their own record; root and admin read any record;
 *   - managing ANOTHER account: root anyone, an admin only accounts with the "user" role (so an admin can never edit or delete a root);
 *   - nobody deletes their own account here (that could lock the system out of its last root);
 *   - giving a role: root any role, an admin only "user". Nobody promotes above themselves.
 */
@Injectable()
export class UserAccessService {
    constructor(private readonly users: UsersService) {}

    assertCanRead(actor: AuthorizedUser, targetId: number): void {
        if (actor.id === targetId || hasAnyRole(actor, RoleEnum.ROOT, RoleEnum.ADMIN)) return;
        throw new InsufficientPermissionsException();
    }

    async assertCanUpdate(actor: AuthorizedUser, targetId: number): Promise<void> {
        if (actor.id === targetId) return;
        await this.assertCanManage(actor, targetId);
    }

    async assertCanDelete(actor: AuthorizedUser, targetId: number): Promise<void> {
        if (actor.id === targetId) throw new InsufficientPermissionsException();
        await this.assertCanManage(actor, targetId);
    }

    assertCanAssignRole(actor: AuthorizedUser, role: string): void {
        if (hasAnyRole(actor, RoleEnum.ROOT)) return;
        if (hasAnyRole(actor, RoleEnum.ADMIN) && role === RoleEnum.USER) return;
        throw new InsufficientPermissionsException();
    }

    /** root: anyone. admin: only accounts holding the default role. A missing target is denied (for root the 404 comes later). */
    private async assertCanManage(actor: AuthorizedUser, targetId: number): Promise<void> {
        if (hasAnyRole(actor, RoleEnum.ROOT)) return;
        if (hasAnyRole(actor, RoleEnum.ADMIN)) {
            const target = await this.users.findOneById(UserDto, targetId, { throwException: false });
            if (target?.role.name === RoleEnum.USER) return;
        }
        throw new InsufficientPermissionsException();
    }
}
