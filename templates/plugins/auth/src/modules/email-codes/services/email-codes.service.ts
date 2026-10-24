import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import { EmailCode, EmailCodePurpose } from '../entities/email-code.entity.js';

/** Plain data operations on the e-mail-code table. Generating, hashing and the rules (lifetime, attempts) live in app/auth (EmailCodesService). */
@Injectable()
export class EmailCodesService {
    constructor(@InjectRepository(EmailCode) private readonly repo: Repository<EmailCode>) {}

    async insert(row: Omit<EmailCode, 'createdAt' | 'attempts'>): Promise<void> {
        await this.repo.insert(row);
    }

    /** The user's current code for this purpose: unused and unexpired (there is at most one: issuing a new one invalidates the old). */
    findActive(userId: number, purpose: EmailCodePurpose, now: Date): Promise<EmailCode | null> {
        return this.repo.findOne({ where: { userId, purpose, usedAt: IsNull(), expiresAt: MoreThan(now) }, order: { createdAt: 'DESC' } });
    }

    /** Counts one attempt in ONE conditional write and says whether it was allowed (unused, unexpired, under `max`). Parallel guesses cannot pass the limit. */
    async takeAttempt(id: string, max: number, now: Date): Promise<boolean> {
        const result = await this.repo.createQueryBuilder().update(EmailCode)
            .set({ attempts: () => 'attempts + 1' })
            .where('code_id = :id AND used_at IS NULL AND expires_at > :now AND attempts < :max', { id, now, max }).execute();
        return result.affected === 1;
    }

    /** Spends the code and says whether THIS call did it. */
    async markUsed(id: string, at: Date): Promise<boolean> {
        const result = await this.repo.createQueryBuilder().update(EmailCode)
            .set({ usedAt: at }).where('code_id = :id AND used_at IS NULL', { id }).execute();
        return result.affected === 1;
    }

    /** Makes every unused code of this purpose for the user unusable. */
    async invalidate(userId: number, purpose: EmailCodePurpose, at: Date): Promise<void> {
        await this.repo.update({ userId, purpose, usedAt: IsNull() }, { usedAt: at });
    }

    async deleteExpiredBefore(at: Date): Promise<void> {
        await this.repo.delete({ expiresAt: LessThan(at) });
    }
}
