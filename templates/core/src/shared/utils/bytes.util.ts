// Counts UTF-8 bytes, not characters: an emoji is 4 bytes. Used by `@MaxBytes` (password length limits are bytes).
export const byteLength = (value: string): number => Buffer.byteLength(value, 'utf8');
