import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { User } from '../entities/user.entity.js';
import { Role } from '../../roles/entities/role.entity.js';
import { RoleNotFoundException } from '../../roles/exceptions/index.js';
import { UserDto } from '../dto/user.dto.js';
import { CreateUserDto } from '../dto/create-user.dto.js';
import { UpdateUserDto } from '../dto/update-user.dto.js';
import { FindAllUsersParamsDto } from '../dto/find-all-users-params.dto.js';
import { UserNotFoundException, UserAlreadyExistsException } from '../exceptions/index.js';
import { DtoRepository, isUniqueViolation } from '../../../shared/orm/index.js';
import { PaginationResponseDto } from '../../../shared/dto/index.js';
import { FindOptions, MutationOptions } from '../../../shared/dto/options.dto.js';
import { hashPassword } from '../../../shared/security/password.util.js';

@Injectable()
export class UsersService {
    private readonly repo: DtoRepository<User>;

    constructor(
        @InjectRepository(User)
        private readonly rawRepo: Repository<User>,
        @InjectRepository(Role)
        private readonly rolesRepo: Repository<Role>,
    ) {
        this.repo = new DtoRepository(rawRepo);
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    async findAll<T>(dto: new () => T, params: FindAllUsersParamsDto): Promise<PaginationResponseDto<T>> {
        return this.repo.findPaginated({
            dto,
            pagination: params,
            where: {
                ...(params.role && { roleName: params.role }),
            },
            order: { createdAt: 'DESC' },
        });
    }

    /**
     * Generic base — looks up a user matching any entity attribute combination.
     * Pass the DTO class to control which fields are selected and returned.
     */
    findOne<T>(dto: new () => T, where: FindOptionsWhere<User>, options: { throwException: false }): Promise<T | null>;
    findOne<T>(dto: new () => T, where: FindOptionsWhere<User>, options?: FindOptions): Promise<T>;
    async findOne<T>(dto: new () => T, where: FindOptionsWhere<User>, { throwException = true }: FindOptions = {}): Promise<T | null> {
        return this._findOne(dto, where, throwException);
    }

    findOneById<T>(dto: new () => T, id: number, options: { throwException: false }): Promise<T | null>;
    findOneById<T>(dto: new () => T, id: number, options?: FindOptions): Promise<T>;
    async findOneById<T>(dto: new () => T, id: number, { throwException = true }: FindOptions = {}): Promise<T | null> {
        return this._findOne(dto, { id }, throwException);
    }

    findOneByEmail<T>(dto: new () => T, email: string, options: { throwException: false }): Promise<T | null>;
    findOneByEmail<T>(dto: new () => T, email: string, options?: FindOptions): Promise<T>;
    async findOneByEmail<T>(dto: new () => T, email: string, { throwException = true }: FindOptions = {}): Promise<T | null> {
        return this._findOne(dto, { email }, throwException);
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    /** Replaces the stored password hash (a reset, or a login re-hashing with a stronger cost). */
    async setPasswordHash(userId: number, passwordHash: string): Promise<void> {
        await this.rawRepo.update(userId, { password: passwordHash });
    }

    async create<T>(returnDto: new () => T, dto: CreateUserDto, options?: MutationOptions): Promise<T> {
        const repo = options?.manager?.getRepository(User) ?? this.rawRepo;

        await this.assertEmailFree(dto.email);
        await this.assertRoleExists(dto.role);

        const user    = repo.create();
        user.email    = dto.email;
        user.password = await hashPassword(dto.password);
        user.roleName = dto.role;

        const saved = await repo.save(user).catch((error: unknown) => {
            throw isUniqueViolation(error) ? new UserAlreadyExistsException() : error;
        });

        // Build DtoRepository from the same repo so the result is visible within any active transaction.
        const result = await new DtoRepository(repo).findOne({ dto: returnDto, where: { id: saved.id } });
        return result!;
    }

    async update<T>(returnDto: new () => T, id: number, dto: UpdateUserDto, options?: MutationOptions): Promise<T> {
        const repo = options?.manager?.getRepository(User) ?? this.rawRepo;

        const current = await this.findOneById(UserDto, id);

        if (dto.email && dto.email !== current.email) await this.assertEmailFree(dto.email);

        const payload: Record<string, any> = {};
        const emailChanged = dto.email !== undefined && dto.email !== current.email;
        if (dto.email    !== undefined) payload.email    = dto.email;
        // A new address is unverified until its owner confirms it (AccountService sends the link).
        if (emailChanged) payload.emailVerifiedAt = null;
        if (dto.role     !== undefined) { await this.assertRoleExists(dto.role); payload.roleName = dto.role; }

        await repo.update(id, payload).catch((error: unknown) => {
            throw isUniqueViolation(error) ? new UserAlreadyExistsException() : error;
        });

        // Ending sessions and sending the verification link are not done here: AccountService (app/auth) does it.
        const result = await new DtoRepository(repo).findOne({ dto: returnDto, where: { id } });
        return result!;
    }

    /** Stores (or clears, with null) the moment the e-mail address was confirmed. */
    async setEmailVerifiedAt(id: number, date: Date | null): Promise<void> {
        await this.rawRepo.update(id, { emailVerifiedAt: date });
    }

    async remove(id: number, options?: MutationOptions): Promise<void> {
        const repo = options?.manager?.getRepository(User) ?? this.rawRepo;
        await this.findOneById(UserDto, id);
        if (options?.hardDelete) {
            await repo.delete(id);
        } else {
            await repo.softDelete(id);
        }
    }

    // ── Private implementation ────────────────────────────────────────────────

    /** A soft-deleted account still owns its e-mail (the unique index covers deleted rows): treat it as taken, not as a crash. */
    private async assertEmailFree(email: string): Promise<void> {
        if (await this.rawRepo.exists({ where: { email }, withDeleted: true })) throw new UserAlreadyExistsException();
    }

    private async assertRoleExists(name: string): Promise<void> {
        if (!(await this.rolesRepo.existsBy({ name }))) throw new RoleNotFoundException();
    }

    private async _findOne<T>(dto: new () => T, where: FindOptionsWhere<User>, throwException: boolean): Promise<T | null> {
        const result = await this.repo.findOne({ dto, where });
        if (!result && throwException) throw new UserNotFoundException();
        return result;
    }
}
