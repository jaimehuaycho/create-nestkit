export interface AuthorizedUser {
    id:             number;
    roles:          string[];
    emailVerified?: boolean;
    twoFactor?:     boolean;
}

/** True when the user holds at least one of the listed roles. This is the whole "who can" check: no hierarchy, no numeric order. */
export function hasAnyRole(user: AuthorizedUser | null, ...roles: string[]): boolean {
    return !!user && user.roles.some((role) => roles.includes(role));
}
