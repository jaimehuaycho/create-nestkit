import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntitySoftDelete } from '../../../database/entities/base.entity.js';
import { Role } from '../../roles/entities/role.entity.js';

@Entity('users')
export class User extends BaseEntitySoftDelete {
    @PrimaryGeneratedColumn({ name: 'user_id' })
    id: number;

    @Column({ name: 'email', type: 'varchar', length: 100, unique: true })
    email: string;

    @Column({ name: 'password', type: 'varchar', length: 255 })
    password: string;

    // When the address was confirmed through the e-mail link (null = not yet). Changing the email resets it.
    @Column({ name: 'email_verified_at', type: Date, nullable: true })
    emailVerifiedAt: Date | null;

    // The role's NAME (foreign key to roles.name). Refresh tokens live in their own table (refresh_tokens).
    @Column({ name: 'role', type: 'varchar', length: 50 })
    roleName: string;

    @ManyToOne(() => Role, (role) => role.users)
    @JoinColumn({ name: 'role', referencedColumnName: 'name' })
    role: Role;
}
