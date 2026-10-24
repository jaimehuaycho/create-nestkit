import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

// Single-use codes for a user who lost their authenticator. Only a keyed hash is stored (HMAC, see TwoFactorService).
@Entity('recovery_codes')
export class RecoveryCode {
    @PrimaryColumn({ name: 'code_hash', type: 'varchar', length: 64 })
    id: string;

    @Index()
    @Column({ name: 'user_id', type: 'int' })
    userId: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @Column({ name: 'used_at', type: Date, nullable: true })
    usedAt: Date | null;
}
