import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

// The step between "password correct" and "second factor correct". Opaque token, only its SHA-256 is stored, it works once,
// it expires fast and it allows a few attempts.
@Entity('mfa_challenges')
export class MfaChallenge {
    @PrimaryColumn({ name: 'token_hash', type: 'varchar', length: 64 })
    id: string;

    @Index()
    @Column({ name: 'user_id', type: 'int' })
    userId: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @Column({ name: 'expires_at', type: Date })
    expiresAt: Date;

    /** Codes tried against this challenge (right or wrong). The attempt is counted BEFORE the code is checked. */
    @Column({ name: 'attempts', type: 'int', default: 0 })
    attempts: number;

    @Column({ name: 'used_at', type: Date, nullable: true })
    usedAt: Date | null;
}
