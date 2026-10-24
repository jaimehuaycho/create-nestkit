import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { RecoveryCode } from '../entities/recovery-code.entity.js';

/** Plain data operations on the recovery-code table. Generating and hashing the codes lives in app/auth (TwoFactorService). */
@Injectable()
export class RecoveryCodesService {
    constructor(@InjectRepository(RecoveryCode) private readonly repo: Repository<RecoveryCode>) {}

    /** Replaces the user's whole set in one transaction (a new set makes every old code useless). */
    async replaceAll(userId: number, hashes: string[]): Promise<void> {
        await this.repo.manager.transaction(async (manager) => {
            await manager.delete(RecoveryCode, { userId });
            await manager.insert(RecoveryCode, hashes.map((id) => ({ id, userId, usedAt: null })));
        });
    }

    /** Marks the code as used in ONE conditional write and says whether THIS call did it (a code works once, even if sent twice at once). */
    async markUsed(userId: number, hash: string, at: Date): Promise<boolean> {
        const result = await this.repo.createQueryBuilder().update(RecoveryCode)
            .set({ usedAt: at }).where('code_hash = :hash AND user_id = :userId AND used_at IS NULL', { hash, userId }).execute();
        return result.affected === 1;
    }

    countUnused(userId: number): Promise<number> {
        return this.repo.countBy({ userId, usedAt: IsNull() });
    }

    async removeAll(userId: number): Promise<void> {
        await this.repo.delete({ userId });
    }
}
