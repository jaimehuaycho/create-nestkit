import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

export type EmailCodePurpose = 'verify_email' | 'reset_password';

// A short code sent by e-mail (6 digits). It cannot be looked up by its own hash like a long random token (a million values, shared across
// users), so a row belongs to a user and a purpose, allows few attempts, expires fast and works once. Only a KEYED hash is stored.
@Entity('email_codes')
export class EmailCode {
    @PrimaryColumn({ name: 'code_id', type: 'varchar', length: 36 })
    id: string;

    @Index()
    @Column({ name: 'user_id', type: 'int' })
    userId: number;

    @Column({ name: 'purpose', type: 'varchar', length: 20 })
    purpose: EmailCodePurpose;

    /** HMAC-SHA256 of user, purpose and code, keyed with a secret that is not in the database. */
    @Column({ name: 'code_hash', type: 'varchar', length: 64 })
    codeHash: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @Column({ name: 'expires_at', type: Date })
    expiresAt: Date;

    /** Codes tried against this row (right or wrong). The attempt is counted BEFORE the code is compared. */
    @Column({ name: 'attempts', type: 'int', default: 0 })
    attempts: number;

    /** Set when the code is used OR replaced by a newer one: either way it can never work again. */
    @Column({ name: 'used_at', type: Date, nullable: true })
    usedAt: Date | null;
}
