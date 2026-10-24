import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

// One row per refresh token. A sign-in starts a FAMILY; every rotation stays in it. Only the SHA-256 of the token is stored.
@Entity('refresh_tokens')
export class RefreshToken {
    /** SHA-256 (hex) of the token: the token itself is never stored. */
    @PrimaryColumn({ name: 'token_hash', type: 'varchar', length: 64 })
    id: string;

    @Index()
    @Column({ name: 'family_id', type: 'varchar', length: 36 })
    familyId: string;

    @Index()
    @Column({ name: 'user_id', type: 'int' })
    userId: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    /** When THIS token stops working. */
    @Column({ name: 'expires_at', type: Date })
    expiresAt: Date;

    /** When the whole family stops working, however often it rotates (absolute lifetime of a sign-in). */
    @Column({ name: 'family_expires_at', type: Date })
    familyExpiresAt: Date;

    /** Set when the token is exchanged for its successor. Presenting a used token again means it was stolen or replayed. */
    @Column({ name: 'used_at', type: Date, nullable: true })
    usedAt: Date | null;

    /** The sign-in that started this family used a second factor: every access token refreshed from it says so (amr). */
    @Column({ name: 'two_factor', type: 'boolean', default: false })
    twoFactor: boolean;

    /** Set on every token of a family when it is revoked (logout, reuse detected, logout everywhere). */
    @Column({ name: 'revoked_at', type: Date, nullable: true })
    revokedAt: Date | null;
}
