import { RoleEnum } from '../../shared/enums/index.js';

// The roles the seed creates and the @Roles() decorators and the auth code refer to. They cannot be deleted through the API.
export const BUILT_IN_ROLES: readonly RoleEnum[] = Object.values(RoleEnum);

// The role every public sign-up gets. Registering NEVER takes a role from the request.
export const DEFAULT_ROLE = RoleEnum.USER;
