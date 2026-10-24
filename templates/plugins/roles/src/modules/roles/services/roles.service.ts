import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { Role } from '../entities/role.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { BUILT_IN_ROLES } from '../roles.constants.js';
import { RoleDto } from '../dto/role.dto.js';
import { CreateRoleDto } from '../dto/create-role.dto.js';
import { UpdateRoleDto } from '../dto/update-role.dto.js';
import { FindAllRolesParamsDto } from '../dto/find-all-roles-params.dto.js';
import { RoleNotFoundException, RoleAlreadyExistsException, RoleInUseException, RoleProtectedException } from '../exceptions/index.js';
import { DtoRepository } from '../../../shared/orm/index.js';
import { PaginationResponseDto } from '../../../shared/dto/index.js';
import { FindOptions, MutationOptions } from '../../../shared/dto/options.dto.js';

// Roles are addressed by NAME everywhere (the primary key): GET /roles/admin, never a numeric id.
@Injectable()
export class RolesService {
    private readonly repo: DtoRepository<Role>;

    constructor(
        @InjectRepository(Role)
        private readonly rawRepo: Repository<Role>,
    ) {
        this.repo = new DtoRepository(rawRepo);
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    async findAll<T>(dto: new () => T, params: FindAllRolesParamsDto): Promise<PaginationResponseDto<T>> {
        return this.repo.findPaginated({
            dto,
            pagination: params,
            where: {
                ...(params.search && { name: ILike(`%${params.search}%`) }),
            },
            order: { name: 'ASC' },
        });
    }

    findOne<T>(dto: new () => T, where: FindOptionsWhere<Role>, options: { throwException: false }): Promise<T | null>;
    findOne<T>(dto: new () => T, where: FindOptionsWhere<Role>, options?: FindOptions): Promise<T>;
    async findOne<T>(dto: new () => T, where: FindOptionsWhere<Role>, { throwException = true }: FindOptions = {}): Promise<T | null> {
        return this._findOne(dto, where, throwException);
    }

    findOneByName<T>(dto: new () => T, name: string, options: { throwException: false }): Promise<T | null>;
    findOneByName<T>(dto: new () => T, name: string, options?: FindOptions): Promise<T>;
    async findOneByName<T>(dto: new () => T, name: string, { throwException = true }: FindOptions = {}): Promise<T | null> {
        return this._findOne(dto, { name }, throwException);
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    async create<T>(returnDto: new () => T, dto: CreateRoleDto, options?: MutationOptions): Promise<T> {
        const repo = options?.manager?.getRepository(Role) ?? this.rawRepo;

        // A deleted role keeps its row, so its name stays taken too (the primary key still exists).
        if (await this.rawRepo.exists({ where: { name: dto.name }, withDeleted: true })) throw new RoleAlreadyExistsException();

        const role       = repo.create();
        role.name        = dto.name;
        role.description = dto.description ?? null;
        await repo.save(role);

        const result = await new DtoRepository(repo).findOne({ dto: returnDto, where: { name: dto.name } });
        return result!;
    }

    async update<T>(returnDto: new () => T, name: string, dto: UpdateRoleDto, options?: MutationOptions): Promise<T> {
        const repo = options?.manager?.getRepository(Role) ?? this.rawRepo;

        await this.findOneByName(RoleDto, name);

        const payload: Record<string, any> = {};
        if (dto.description !== undefined) payload.description = dto.description;
        if (Object.keys(payload).length > 0) await repo.update({ name }, payload);

        const result = await new DtoRepository(repo).findOne({ dto: returnDto, where: { name } });
        return result!;
    }

    async remove(name: string, options?: MutationOptions): Promise<void> {
        const repo = options?.manager?.getRepository(Role) ?? this.rawRepo;
        await this.findOneByName(RoleDto, name);
        if ((BUILT_IN_ROLES as readonly string[]).includes(name)) throw new RoleProtectedException();
        // Deleting a role someone holds would break sign-in and sign-up for them (their role would no longer exist).
        if (await this.rawRepo.manager.exists(User, { where: { roleName: name }, withDeleted: true })) throw new RoleInUseException();
        if (options?.hardDelete) {
            await repo.delete({ name });
        } else {
            await repo.softDelete({ name });
        }
    }

    // ── Private implementation ────────────────────────────────────────────────

    private async _findOne<T>(dto: new () => T, where: FindOptionsWhere<Role>, throwException: boolean): Promise<T | null> {
        const role = await this.repo.findOne({ dto, where });
        if (!role && throwException) throw new RoleNotFoundException();
        return role;
    }
}
