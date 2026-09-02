import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntitySoftDelete } from '../../../database/entities/base.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('roles')
export class Role extends BaseEntitySoftDelete {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'name', type: 'varchar', length: 50, unique: true })
    name: string;

    // Inverse side of the relation — not loaded unless explicitly requested.
    @OneToMany(() => User, (user) => user.role)
    users: User[];
}
