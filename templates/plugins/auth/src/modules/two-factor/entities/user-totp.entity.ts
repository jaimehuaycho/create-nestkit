import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

// One row per user that started setting up TOTP. `confirmedAt` is null until the user proves they scanned the secret with a first code.
@Entity('user_totp')
export class UserTotp {
    @PrimaryColumn({ name: 'user_id', type: 'int' })
    userId: number;

    /** The TOTP secret, ENCRYPTED (AES-256-GCM, see app/auth/utils/secret-box.util.ts). Never the plain secret. */
    @Column({ name: 'secret', type: 'varchar', length: 255 })
    secret: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    /** Set when setup is confirmed with a valid code. While null, 2FA is NOT active for the user. */
    @Column({ name: 'confirmed_at', type: Date, nullable: true })
    confirmedAt: Date | null;

    /** The last 30-second step whose code was accepted: a code of that step or an older one is never accepted again (replay). */
    @Column({ name: 'last_used_step', type: 'int', nullable: true })
    lastUsedStep: number | null;
}
