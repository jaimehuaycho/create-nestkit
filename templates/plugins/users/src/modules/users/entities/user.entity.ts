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

    // Stores the bcrypt hash of the active refresh token.
    // null = no active session (never logged in, logged out, or token revoked).
    @Column({ name: 'refresh_token', type: 'varchar', length: 500, nullable: true })
    refreshToken: string | null;

    // FK column stored in DB — also used in JWT payload and RolesGuard (1=root, 2=admin, 3=user).
    @Column({ name: 'role_id', type: 'int' })
    roleId: number;

    @ManyToOne(() => Role, (role) => role.users)
    @JoinColumn({ name: 'role_id' })
    role: Role;
}
