import { createHmac, randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import * as OTPAuth from 'otpauth';
import { UserTotpService } from '../../../modules/two-factor/services/user-totp.service.js';
import { RecoveryCodesService } from '../../../modules/two-factor/services/recovery-codes.service.js';
import { MfaChallengesService } from '../../../modules/two-factor/services/mfa-challenges.service.js';
import { TwoFactorConfig } from '../config/two-factor.config.js';
import {
    InvalidTwoFactorChallengeException, InvalidTwoFactorCodeException, InvalidTwoFactorCodeForbiddenException,
    TwoFactorAlreadyEnabledException, TwoFactorNotEnabledException, TwoFactorSetupNotStartedException,
} from '../exceptions/index.js';
import { generateRefreshToken, hashRefreshToken } from '../utils/token.util.js';
import { decryptSecret, encryptSecret } from '../utils/secret-box.util.js';

const STEP_SECONDS      = 30;
const WINDOW_STEPS      = 1;   // accepts the previous and the next 30 s too (clock drift between the phone and the server)
// No 0/1/i/l/o: easy to misread when typed from paper.
const RECOVERY_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
const RECOVERY_LENGTH   = 10;

/**
 * Time-based one-time passwords (RFC 6238) for sign-in: setup, enable, verify, disable, recovery codes and the sign-in challenge.
 * The data lives in modules/two-factor; this class holds the rules.
 */
@Injectable()
export class TwoFactorService {
    constructor(
        private readonly totp:       UserTotpService,
        private readonly recovery:   RecoveryCodesService,
        private readonly challenges: MfaChallengesService,
        private readonly cfg:        TwoFactorConfig,
    ) {}

    // ── Management (a signed-in user) ─────────────────────────────────────────

    async isEnabled(userId: number): Promise<boolean> {
        return !!(await this.totp.find(userId))?.confirmedAt;
    }

    async status(userId: number): Promise<{ enabled: boolean; recoveryCodesLeft: number }> {
        const enabled = await this.isEnabled(userId);
        return { enabled, recoveryCodesLeft: enabled ? await this.recovery.countUnused(userId) : 0 };
    }

    /** Creates a secret that is NOT active yet. The user scans it and proves it with `enable`. Calling it again starts over. */
    async setup(userId: number, accountName: string): Promise<{ secret: string; otpauthUrl: string }> {
        if (await this.isEnabled(userId)) throw new TwoFactorAlreadyEnabledException();
        const secret = new OTPAuth.Secret({ size: 20 });
        await this.totp.savePending(userId, encryptSecret(secret.base32, this.cfg.key));
        return { secret: secret.base32, otpauthUrl: this.newTotp(secret, accountName).toString() };
    }

    /** Confirms the setup with a first valid code, switches 2FA on and returns the recovery codes (the only time they are shown). */
    async enable(userId: number, code: string): Promise<string[]> {
        const row = await this.totp.find(userId);
        if (!row) throw new TwoFactorSetupNotStartedException();
        if (row.confirmedAt) throw new TwoFactorAlreadyEnabledException();

        const step = this.matchStep(row.secret, code);
        if (step === null) throw new InvalidTwoFactorCodeForbiddenException();

        await this.totp.confirm(userId, new Date(), step);
        return await this.newRecoveryCodes(userId);
    }

    async disable(userId: number, code: string): Promise<void> {
        await this.assertValidCode(userId, code);
        await this.reset(userId);
    }

    async regenerateRecoveryCodes(userId: number, code: string): Promise<string[]> {
        await this.assertValidCode(userId, code);
        return await this.newRecoveryCodes(userId);
    }

    /** Removes everything 2FA about the user (lost device handled by an administrator, or the user turning it off). */
    async reset(userId: number): Promise<void> {
        await this.totp.remove(userId);
        await this.recovery.removeAll(userId);
        await this.challenges.invalidateForUser(userId, new Date());
    }

    // ── Sign-in ───────────────────────────────────────────────────────────────

    /** Called when the password was right and the user has 2FA: the caller sends back this token instead of a session. */
    async createChallenge(userId: number): Promise<{ challengeToken: string; expiresIn: number }> {
        const now = new Date();
        void this.challenges.deleteExpiredBefore(now).catch(() => undefined);   // housekeeping; must never break a sign-in
        const challengeToken = generateRefreshToken();
        await this.challenges.insert({ id: hashRefreshToken(challengeToken), userId, expiresAt: new Date(now.getTime() + this.cfg.challengeTtlMs), usedAt: null });
        return { challengeToken, expiresIn: Math.floor(this.cfg.challengeTtlMs / 1000) };
    }

    /** Checks the code against the challenge and returns the user to sign in. An authenticator code or a recovery code both work. */
    async completeChallenge(challengeToken: string, code: string): Promise<number> {
        const id  = hashRefreshToken(challengeToken);
        const row = await this.challenges.find(id);
        const now = new Date();
        if (!row || row.usedAt || row.expiresAt <= now) throw new InvalidTwoFactorChallengeException();

        // The attempt is counted BEFORE the code is checked, in one conditional write: guesses made at the same time cannot exceed the limit.
        if (!(await this.challenges.takeAttempt(id, this.cfg.maxAttempts, now))) throw new InvalidTwoFactorChallengeException();
        if (!(await this.verifyCode(row.userId, code))) throw new InvalidTwoFactorCodeException();
        if (!(await this.challenges.markUsed(id, new Date()))) throw new InvalidTwoFactorChallengeException();
        return row.userId;
    }

    // ── internals ─────────────────────────────────────────────────────────────

    private async assertValidCode(userId: number, code: string): Promise<void> {
        if (!(await this.isEnabled(userId))) throw new TwoFactorNotEnabledException();
        if (!(await this.verifyCode(userId, code))) throw new InvalidTwoFactorCodeForbiddenException();
    }

    /** A 6-digit code is checked as TOTP (and its time step can never be used twice); anything else as a recovery code (works once). */
    private async verifyCode(userId: number, code: string): Promise<boolean> {
        const row = await this.totp.find(userId);
        if (!row?.confirmedAt) return false;

        if (/^\d{6}$/.test(code)) {
            const step = this.matchStep(row.secret, code);
            return step !== null && (await this.totp.advanceStep(userId, step));
        }
        const normalized = normalizeRecovery(code);
        if (normalized.length !== RECOVERY_LENGTH) return false;
        return await this.recovery.markUsed(userId, this.hashRecovery(normalized), new Date());
    }

    /** The 30-second step the code belongs to (within the allowed drift), or null when it matches none. */
    private matchStep(encryptedSecret: string, code: string): number | null {
        const totp    = this.newTotp(OTPAuth.Secret.fromBase32(decryptSecret(encryptedSecret, this.cfg.key)), 'account');
        const counter = totp.counter();   // documented by otpauth for exactly this: telling which interval a code belongs to (reuse protection)
        const delta   = totp.validate({ token: code, window: WINDOW_STEPS });
        return delta === null ? null : counter + delta;
    }

    private newTotp(secret: OTPAuth.Secret, label: string): OTPAuth.TOTP {
        return new OTPAuth.TOTP({ issuer: this.cfg.issuer, label, algorithm: 'SHA1', digits: 6, period: STEP_SECONDS, secret });
    }

    private async newRecoveryCodes(userId: number): Promise<string[]> {
        const codes = Array.from({ length: this.cfg.recoveryCodeCount }, () =>
            Array.from({ length: RECOVERY_LENGTH }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]).join(''));
        await this.recovery.replaceAll(userId, codes.map((c) => this.hashRecovery(c)));
        return codes.map((c) => `${c.slice(0, 5)}-${c.slice(5)}`);
    }

    // Keyed (HMAC) and not a plain hash: a recovery code has ~50 bits, which a leaked table alone could not protect from offline guessing.
    private hashRecovery(normalized: string): string {
        return createHmac('sha256', this.cfg.key).update(normalized).digest('hex');
    }
}

const normalizeRecovery = (code: string): string => code.toLowerCase().replace(/[^a-z0-9]/g, '');
