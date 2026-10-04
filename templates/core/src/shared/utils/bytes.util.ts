// bcrypt only uses the first 72 BYTES of its input and silently ignores the rest (bcrypt README; OWASP Password Storage
// Cheat Sheet: "enforce a maximum password length of 72 bytes"). Characters are not bytes: UTF-8 emoji take up to 4.
export const BCRYPT_MAX_BYTES = 72;

export const byteLength = (value: string): number => Buffer.byteLength(value, 'utf8');
