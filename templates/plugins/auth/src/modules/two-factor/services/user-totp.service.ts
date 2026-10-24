import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTotp } from '../entities/user-totp.entity.js';

/** Plain data operations on the TOTP table. The rules (codes, encryption, replay) live in app/auth (TwoFactorService). */
@Injectable()
export class UserTotpService {
    constructor(@InjectRepository(UserTotp) private readonly repo: Repository<UserTotp>) {}

    find(userId: number): Promise<UserTotp | null> {
        return this.repo.findOneBy({ userId });
    }

    /** Stores a NEW, unconfirmed secret, replacing any previous one (a setup that was never confirmed, or a restart). */
    async savePending(userId: number, encryptedSecret: string): Promise<void> {
        await this.repo.save({ userId, secret: encryptedSecret, confirmedAt: null, lastUsedStep: null });
    }

    async confirm(userId: number, at: Date, step: number): Promise<void> {
        await this.repo.update({ userId }, { confirmedAt: at, lastUsedStep: step });
    }

    /**
     * Records `step` as used in ONE conditional write and says whether it was newer than the last one. Of two simultaneous requests with
     * the same code, exactly one gets `true`.
     */
    async advanceStep(userId: number, step: number): Promise<boolean> {
        const result = await this.repo.createQueryBuilder().update(UserTotp)
            .set({ lastUsedStep: step })
            .where('user_id = :userId AND (last_used_step IS NULL OR last_used_step < :step)', { userId, step }).execute();
        return result.affected === 1;
    }

    async remove(userId: number): Promise<void> {
        await this.repo.delete({ userId });
    }
}
