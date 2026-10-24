import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { MfaChallenge } from '../entities/mfa-challenge.entity.js';

/** Plain data operations on the challenge table. Lifetimes and attempt limits are decided in app/auth (TwoFactorService). */
@Injectable()
export class MfaChallengesService {
    constructor(@InjectRepository(MfaChallenge) private readonly repo: Repository<MfaChallenge>) {}

    find(id: string): Promise<MfaChallenge | null> {
        return this.repo.findOneBy({ id });
    }

    async insert(row: Omit<MfaChallenge, 'createdAt' | 'attempts'>): Promise<void> {
        await this.repo.insert(row);
    }

    /**
     * Counts one attempt in ONE conditional write and says whether it was allowed: the challenge must exist, be unused, unexpired and under
     * `max` attempts. Simultaneous guesses cannot get past the limit.
     */
    async takeAttempt(id: string, max: number, now: Date): Promise<boolean> {
        const result = await this.repo.createQueryBuilder().update(MfaChallenge)
            .set({ attempts: () => 'attempts + 1' })
            .where('token_hash = :id AND used_at IS NULL AND expires_at > :now AND attempts < :max', { id, now, max }).execute();
        return result.affected === 1;
    }

    /** Spends the challenge (it can no longer be used) and says whether THIS call did it. */
    async markUsed(id: string, at: Date): Promise<boolean> {
        const result = await this.repo.createQueryBuilder().update(MfaChallenge)
            .set({ usedAt: at }).where('token_hash = :id AND used_at IS NULL', { id }).execute();
        return result.affected === 1;
    }

    async invalidateForUser(userId: number, at: Date): Promise<void> {
        await this.repo.update({ userId, usedAt: IsNull() }, { usedAt: at });
    }

    async deleteExpiredBefore(at: Date): Promise<void> {
        await this.repo.delete({ expiresAt: LessThan(at) });
    }
}
