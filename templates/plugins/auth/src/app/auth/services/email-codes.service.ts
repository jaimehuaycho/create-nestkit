import { createHmac, hkdfSync, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EmailCodesService as EmailCodesData } from '../../../modules/email-codes/services/email-codes.service.js';
import type { EmailCodePurpose } from '../../../modules/email-codes/entities/email-code.entity.js';
import { JwtConfig } from '../config/jwt.config.js';
import { EMAIL_CODES } from '../config/email-codes.config.js';
import { InvalidEmailCodeException } from '../exceptions/index.js';

/**
 * The 6-digit codes sent by e-mail (confirm the address, reset the password). A code has only a million values, so what makes it
 * safe is everything around it: it belongs to ONE user and purpose, lives minutes, allows 5 attempts (counted before comparing), works
 * once, and only a keyed hash is stored (a leaked table cannot be brute-forced offline without the key).
 */
@Injectable()
export class EmailCodesService {
    // A key of its own, derived from the JWT secret (HKDF), so the signing key itself is never used to hash codes.
    private readonly key: Buffer;

    constructor(private readonly data: EmailCodesData, jwt: JwtConfig) {
        this.key = Buffer.from(hkdfSync('sha256', jwt.secret, 'create-nestkit', 'email-codes', 32));
    }

    /** Creates a code and returns it (to be e-mailed). Any earlier unused code of the same purpose for this user stops working. */
    async issue(userId: number, purpose: EmailCodePurpose): Promise<string> {
        const now = new Date();
        await this.data.invalidate(userId, purpose, now);
        void this.data.deleteExpiredBefore(now).catch(() => undefined);   // housekeeping; must never break the request

        const code = String(randomInt(0, 10 ** EMAIL_CODES.length)).padStart(EMAIL_CODES.length, '0');
        const ttl  = purpose === 'verify_email' ? EMAIL_CODES.verifyTtlMs : EMAIL_CODES.resetTtlMs;
        await this.data.insert({ id: randomUUID(), userId, purpose, codeHash: this.hash(userId, purpose, code), expiresAt: new Date(now.getTime() + ttl), usedAt: null });
        return code;
    }

    /** Spends the user's code if it matches. Throws 400 INVALID_EMAIL_CODE otherwise (the same error for every reason). */
    async consume(userId: number, purpose: EmailCodePurpose, code: string): Promise<void> {
        const now = new Date();
        const row = await this.data.findActive(userId, purpose, now);
        if (!row) { this.hash(userId, purpose, code); throw new InvalidEmailCodeException(); }   // same work as the matching path

        // The attempt is counted BEFORE comparing, in one conditional write: simultaneous guesses cannot exceed the limit.
        if (!(await this.data.takeAttempt(row.id, EMAIL_CODES.maxAttempts, now))) throw new InvalidEmailCodeException();

        const expected = Buffer.from(row.codeHash, 'hex');
        const given    = Buffer.from(this.hash(userId, purpose, code), 'hex');
        if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new InvalidEmailCodeException();
        if (!(await this.data.markUsed(row.id, new Date()))) throw new InvalidEmailCodeException();
    }

    /** For a request about an account that does not exist: does the work of a real check, so timing does not tell the two apart. */
    spendTimeLikeAConsume(purpose: EmailCodePurpose, code: string): void {
        this.hash(0, purpose, code);
    }

    /** Makes the user's pending codes of this purpose unusable (a password or address change must kill them). */
    async invalidate(userId: number, purpose: EmailCodePurpose): Promise<void> {
        await this.data.invalidate(userId, purpose, new Date());
    }

    private hash(userId: number, purpose: EmailCodePurpose, code: string): string {
        return createHmac('sha256', this.key).update(`${userId}:${purpose}:${code}`).digest('hex');
    }
}
