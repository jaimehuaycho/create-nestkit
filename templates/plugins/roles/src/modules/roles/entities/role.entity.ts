import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { BaseEntitySoftDelete } from '../../../database/entities/base.entity.js';
import { User } from '../../users/entities/user.entity.js';

// A role is identified by its NAME (the values of RoleEnum, plus any role created later): a stable text key that the token, the @Roles()
// decorators and the API all use. There is no numeric id and no hierarchy: what a role may do is listed explicitly on each route with
// @Roles(...). A name never changes once created; the description can.
@Entity('roles')
export class Role extends BaseEntitySoftDelete {
    @PrimaryColumn({ name: 'name', type: 'varchar', length: 50 })
    name: string;

    @Column({ name: 'description', type: 'varchar', length: 255, nullable: true })
    description: string | null;

    // Inverse side of the relation — not loaded unless explicitly requested.
    @OneToMany(() => User, (user) => user.role)
    users: User[];
}
