// The roles the application ships with. Code NEVER writes a role name as a string ('root', 'admin'...): it uses these members, so a
// typo is a compile error and renaming a role is one edit. Roles are identified by this NAME (see the roles table). Add yours here and
// seed them (src/database/seeds/seed.ts); a role created at runtime through the API is data, not code, and has no member here.
export enum RoleEnum {
    ROOT  = 'root',
    ADMIN = 'admin',
    USER  = 'user',
}
