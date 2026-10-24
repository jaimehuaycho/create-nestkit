import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Not, Repository } from 'typeorm';
import { RefreshToken } from '../entities/refresh-token.entity.js';

/** Plain data operations on the refresh-token table. The rules (rotation, reuse detection, lifetimes) live in app/auth (SessionsService). */
@Injectable()
export class RefreshTokensService {
    constructor(@InjectRepository(RefreshToken) private readonly repo: Repository<RefreshToken>) {}

    findById(id: string): Promise<RefreshToken | null> {
        return this.repo.findOneBy({ id });
    }

    async insert(row: Omit<RefreshToken, 'createdAt'>): Promise<void> {
        await this.repo.insert(row);
    }

    /**
     * Marks the token as used in ONE conditional write and says whether THIS call did it. Of several concurrent presentations of the
     * same token exactly one gets `true`.
     */
    async markUsed(id: string, at: Date): Promise<boolean> {
        const result = await this.repo.createQueryBuilder().update(RefreshToken)
            .set({ usedAt: at }).where('token_hash = :id AND used_at IS NULL', { id }).execute();
        return result.affected === 1;
    }

    async revokeFamily(familyId: string, at: Date): Promise<void> {
        await this.repo.update({ familyId, revokedAt: IsNull() }, { revokedAt: at });
    }

    async revokeAllForUser(userId: number, at: Date): Promise<void> {
        await this.repo.update({ userId, revokedAt: IsNull() }, { revokedAt: at });
    }

    isFamilyRevoked(familyId: string): Promise<boolean> {
        return this.repo.existsBy({ familyId, revokedAt: Not(IsNull()) });
    }

    async deleteFamiliesExpiredBefore(at: Date): Promise<void> {
        await this.repo.delete({ familyExpiresAt: LessThan(at) });
    }
}
