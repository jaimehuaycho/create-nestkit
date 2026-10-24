// The password hashing algorithm is a choice the user makes when Auth is selected. Each entry knows its npm packages, which
// of them run an install script, the password length it accepts, and the source of the generated module. The generated
// project's users service, auth service, seed and DTOs only import `hashPassword`, `comparePassword`,
// `PASSWORD_MAX_BYTES`, `PASSWORD_MIN_LENGTH` and `needsRehash` from `src/shared/security/password.util.ts`, so they do not care which one was chosen.

export type PasswordHasherId = 'bcrypt' | 'argon2';

export interface PasswordHasher {
    id:            PasswordHasherId;
    label:         string;
    hint:          string;
    dependencies:  { prod: string[]; dev: string[] };
    allowScripts:  string[];     // packages whose install script must run (native addons), for the npm allowScripts policy
    maxBytes:      number;       // longest password accepted; becomes PASSWORD_MAX_BYTES
    source:        string;       // content of src/shared/security/password.util.ts
}

export const DEFAULT_PASSWORD_HASHER: PasswordHasherId = 'bcrypt';

const BCRYPT_SOURCE = `import bcrypt from 'bcrypt';

// bcrypt only uses the first 72 BYTES of its input and silently ignores the rest (bcrypt README; OWASP Password Storage
// Cheat Sheet: "enforce a maximum password length of 72 bytes"). The DTOs reject anything longer with @MaxBytes.
export const PASSWORD_MAX_BYTES = 72;

// Minimum length of a NEW password (NIST SP 800-63B allows 8; Nest's own docs example uses 12).
export const PASSWORD_MIN_LENGTH = 12;

// bcrypt is intentionally slow (SALT_ROUNDS controls the cost factor), which makes brute force expensive. Each increment
// doubles the work; OWASP's minimum is 10.
const SALT_ROUNDS = 10;

export const hashPassword = async (plainPassword: string): Promise<string> => {
    return bcrypt.hash(plainPassword, SALT_ROUNDS);
};

export const comparePassword = async (plainPassword: string, hashedPassword: string): Promise<boolean> => {
    return bcrypt.compare(plainPassword, hashedPassword);
};

// True when the stored hash was made with a lower cost than today's SALT_ROUNDS (or is not a bcrypt hash at all): the login
// code re-hashes the password it has just verified, so raising the cost upgrades every account the next time its owner signs in.
export const needsRehash = (hashedPassword: string): boolean => {
    try {
        return bcrypt.getRounds(hashedPassword) < SALT_ROUNDS;
    } catch {
        return true;
    }
};
`;

const ARGON2_SOURCE = `import argon2 from 'argon2';

// Argon2 has no 72-byte truncation. This is only a guard against absurdly long inputs (denial of service): the DTOs
// reject anything longer with @MaxBytes.
export const PASSWORD_MAX_BYTES = 256;

// Minimum length of a NEW password (NIST SP 800-63B allows 8; Nest's own docs example uses 12).
export const PASSWORD_MIN_LENGTH = 12;

// Argon2id with the library's own defaults (64 MiB of memory, 3 iterations, 4 lanes). Its maintainers warn that deviating
// from them reduces security, and they exceed OWASP's minimum Argon2id profile. The cost parameters are stored inside each
// hash, so changing them later does not invalidate existing passwords.
export const hashPassword = async (plainPassword: string): Promise<string> => {
    return argon2.hash(plainPassword, { type: argon2.argon2id });
};

export const comparePassword = async (plainPassword: string, hashedPassword: string): Promise<boolean> => {
    try {
        return await argon2.verify(hashedPassword, plainPassword);
    } catch {
        // verify() throws on a malformed stored hash: that is "no match", not a server error.
        return false;
    }
};

// True when the stored hash was made with other parameters than today's defaults (or is not an Argon2id hash at all): the login
// code re-hashes the password it has just verified, so changing the cost upgrades every account the next time its owner signs in.
export const needsRehash = (hashedPassword: string): boolean => {
    try {
        return !hashedPassword.startsWith('$argon2id$') || argon2.needsRehash(hashedPassword);
    } catch {
        return true;
    }
};
`;

export const PASSWORD_HASHERS: Record<PasswordHasherId, PasswordHasher> = {
    bcrypt: {
        id:           'bcrypt',
        label:        'bcrypt',
        hint:         'battle-tested, prebuilt binaries (default)',
        dependencies: { prod: ['bcrypt'], dev: ['@types/bcrypt'] },
        allowScripts: ['bcrypt'],
        maxBytes:     72,
        source:       BCRYPT_SOURCE,
    },
    argon2: {
        id:           'argon2',
        label:        'Argon2id',
        hint:         "memory-hard, OWASP's first choice",
        dependencies: { prod: ['argon2'], dev: [] },
        allowScripts: ['argon2'],
        maxBytes:     256,
        source:       ARGON2_SOURCE,
    },
};

export function getPasswordHasher(id: string | undefined): PasswordHasher {
    return PASSWORD_HASHERS[(id as PasswordHasherId) ?? DEFAULT_PASSWORD_HASHER] ?? PASSWORD_HASHERS[DEFAULT_PASSWORD_HASHER];
}

// Where the chosen hasher's module lives in a generated project.
export const PASSWORD_UTIL_PATH = 'src/shared/security/password.util.ts';
