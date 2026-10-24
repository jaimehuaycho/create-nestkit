// Rules for the codes sent by e-mail. Fixed on purpose (not environment variables): short lifetimes and few attempts are what keep a
// 6-digit code safe, so they are not something to loosen per deployment. Change them here if you must.
export const EMAIL_CODES = {
    /** Digits in a code. */
    length:         6,
    /** Time to confirm the address after asking for the code. */
    verifyTtlMs:    15 * 60_000,
    /** Time to reset the password after asking for the code. */
    resetTtlMs:     10 * 60_000,
    /** Codes that may be tried against one issued code; then a new one must be requested (which is rate limited). */
    maxAttempts:    5,
} as const;
