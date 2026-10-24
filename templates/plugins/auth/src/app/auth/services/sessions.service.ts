import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtConfig } from '../config/jwt.config.js';
import { InvalidRefreshTokenException, RefreshTokenReusedException } from '../exceptions/index.js';
import { RefreshTokensService } from '../../../modules/refresh-tokens/services/refresh-tokens.service.js';
import { generateRefreshToken, hashRefreshToken } from '../utils/token.util.js';

/**
 * Refresh tokens in FAMILIES. Each sign-in starts one; every rotation stays in it and cannot outlive the family's absolute
 * expiry. A token works once: presenting a used token again means two parties hold it, so the whole family is revoked.
 * Several devices = several families, so one device signing in never ends another's session, and one can sign out alone.
 */
@Injectable()
export class SessionsService {
    constructor(
        private readonly tokens: RefreshTokensService,
        private readonly jwtConfig: JwtConfig,
    ) {}

    /** Starts a new family (a sign-in) and returns its first refresh token. */
    async issue(userId: number, twoFactor = false): Promise<string> {
        const now = new Date();
        void this.deleteExpiredFamilies(now);   // keeps the table bounded; a failure here must never break a sign-in
        return this.save(userId, randomUUID(), now, new Date(now.getTime() + this.jwtConfig.refreshFamilyTtlMs), twoFactor);
    }

    /** Spends a refresh token and returns its successor (same family). Throws 401 for unknown, expired, revoked or reused tokens. */
    async rotate(token: string): Promise<{ userId: number; refreshToken: string; twoFactor: boolean }> {
        const id  = hashRefreshToken(token);
        const row = await this.tokens.findById(id);
        if (!row) throw new InvalidRefreshTokenException();

        const now = new Date();
        if (row.revokedAt || (await this.tokens.isFamilyRevoked(row.familyId))) throw new InvalidRefreshTokenException();
        if (row.expiresAt <= now || row.familyExpiresAt <= now)          throw new InvalidRefreshTokenException();

        // ONE conditional write: of several concurrent presentations exactly one flips used_at; the rest are a reuse.
        if (!(await this.tokens.markUsed(id, now))) {
            await this.tokens.revokeFamily(row.familyId, new Date());
            throw new RefreshTokenReusedException();
        }

        const successor = await this.save(row.userId, row.familyId, now, row.familyExpiresAt, row.twoFactor);

        // A reuse can revoke the family between the write above and the insert: do not leave a live token behind.
        if (await this.tokens.isFamilyRevoked(row.familyId)) {
            await this.tokens.revokeFamily(row.familyId, new Date());
            throw new InvalidRefreshTokenException();
        }
        return { userId: row.userId, refreshToken: successor, twoFactor: row.twoFactor };
    }

    /** Signs out ONE device: revokes the family of this token. Silent for unknown tokens (RFC 7009: do not reveal which exist). */
    async revokeByToken(token: string): Promise<void> {
        const row = await this.tokens.findById(hashRefreshToken(token));
        if (row) await this.tokens.revokeFamily(row.familyId, new Date());
    }

    /** Signs the user out of every device. Families started later are not affected. */
    async revokeAllForUser(userId: number): Promise<void> {
        await this.tokens.revokeAllForUser(userId, new Date());
    }

    // ── internals ─────────────────────────────────────────────────────────────

    private async save(userId: number, familyId: string, now: Date, familyExpiresAt: Date, twoFactor: boolean): Promise<string> {
        const token     = generateRefreshToken();
        const expiresAt = new Date(Math.min(now.getTime() + this.jwtConfig.refreshTtlMs, familyExpiresAt.getTime()));
        await this.tokens.insert({ id: hashRefreshToken(token), familyId, userId, expiresAt, familyExpiresAt, twoFactor, usedAt: null, revokedAt: null });
        return token;
    }

    private async deleteExpiredFamilies(now: Date): Promise<void> {
        try {
            await this.tokens.deleteFamiliesExpiredBefore(now);
        } catch {
            // Best-effort housekeeping: the next sign-in tries again.
        }
    }
}
