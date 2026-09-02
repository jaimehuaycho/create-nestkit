import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { Role } from '../entities/role.entity.js';
import { RoleDto } from '../dto/role.dto.js';
import { CreateRoleDto } from '../dto/create-role.dto.js';
import { UpdateRoleDto } from '../dto/update-role.dto.js';
import { FindAllRolesParamsDto } from '../dto/find-all-roles-params.dto.js';
import { RoleNotFoundException, RoleAlreadyExistsException } from '../exceptions/index.js';
import { DtoRepository } from '../../../shared/orm/index.js';
import { PaginationResponseDto } from '../../../shared/dto/index.js';
import { FindOptions, MutationOptions } from '../../../shared/dto/options.dto.js';

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
            order: { id: 'ASC' },
        });
    }

    /**
     * Generic base — looks up a role matching any entity attribute combination.
     * Pass the DTO class to control which fields are selected and returned.
     */
    findOne<T>(dto: new () => T, where: FindOptionsWhere<Role>, options: { throwException: false }): Promise<T | null>;
    findOne<T>(dto: new () => T, where: FindOptionsWhere<Role>, options?: FindOptions): Promise<T>;
    async findOne<T>(dto: new () => T, where: FindOptionsWhere<Role>, { throwException = true }: FindOptions = {}): Promise<T | null> {
        return this._findOne(dto, where, throwException);
    }

    findOneById<T>(dto: new () => T, id: number, options: { throwException: false }): Promise<T | null>;
    findOneById<T>(dto: new () => T, id: number, options?: FindOptions): Promise<T>;
    async findOneById<T>(dto: new () => T, id: number, { throwException = true }: FindOptions = {}): Promise<T | null> {
        return this._findOne(dto, { id }, throwException);
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    async create<T>(returnDto: new () => T, dto: CreateRoleDto, options?: MutationOptions): Promise<T> {
        const repo = options?.manager?.getRepository(Role) ?? this.rawRepo;

        if (await this.rawRepo.existsBy({ name: dto.name })) throw new RoleAlreadyExistsException();

        const role  = repo.create();
        role.name   = dto.name;

        const saved  = await repo.save(role);

        const result = await new DtoRepository(repo).findOne({ dto: returnDto, where: { id: saved.id } });
        return result!;
    }

    async update<T>(returnDto: new () => T, id: number, dto: UpdateRoleDto, options?: MutationOptions): Promise<T> {
        const repo = options?.manager?.getRepository(Role) ?? this.rawRepo;

        const current = await this.findOneById(RoleDto, id);

        if (dto.name && dto.name !== current.name) {
            if (await this.rawRepo.existsBy({ name: dto.name })) throw new RoleAlreadyExistsException();
        }

        const payload: Record<string, any> = {};
        if (dto.name !== undefined) payload.name = dto.name;

        await repo.update(id, payload);

        const result = await new DtoRepository(repo).findOne({ dto: returnDto, where: { id } });
        return result!;
    }

    async remove(id: number, options?: MutationOptions): Promise<void> {
        const repo = options?.manager?.getRepository(Role) ?? this.rawRepo;
        await this.findOneById(RoleDto, id);
        if (options?.hardDelete) {
            await repo.delete(id);
        } else {
            await repo.softDelete(id);
        }
    }

    // ── Private implementation ────────────────────────────────────────────────

    private async _findOne<T>(dto: new () => T, where: FindOptionsWhere<Role>, throwException: boolean): Promise<T | null> {
        const role = await this.repo.findOne({ dto, where });
        if (!role && throwException) throw new RoleNotFoundException();
        return role;
    }
}
