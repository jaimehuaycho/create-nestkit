import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { User } from '../entities/user.entity.js';
import { UserDto } from '../dto/user.dto.js';
import { CreateUserDto } from '../dto/create-user.dto.js';
import { UpdateUserDto } from '../dto/update-user.dto.js';
import { FindAllUsersParamsDto } from '../dto/find-all-users-params.dto.js';
import { UserNotFoundException, UserAlreadyExistsException } from '../exceptions/index.js';
import { DtoRepository } from '../../../shared/orm/index.js';
import { FindOptions, MutationOptions, PaginationResponseDto } from '../../../shared/dto/index.js';
import { hashPassword } from '../../../shared/utils/crypto.util.js';

@Injectable()
export class UsersService {
    private readonly repo: DtoRepository<User>;

    constructor(
        @InjectRepository(User)
        private readonly rawRepo: Repository<User>,
    ) {
        this.repo = new DtoRepository(rawRepo);
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    async findAll<T>(dto: new () => T, params: FindAllUsersParamsDto): Promise<PaginationResponseDto<T>> {
        return this.repo.findPaginated({
            dto,
            pagination: params,
            where: {
                ...(params.roleId && { roleId: params.roleId }),
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

    /** Persists the hashed refresh token. Pass null to close the session (logout / revocation). */
    async setRefreshToken(userId: number, hashedToken: string | null): Promise<void> {
        await this.rawRepo.update(userId, { refreshToken: hashedToken });
    }

    async create<T>(returnDto: new () => T, dto: CreateUserDto, options?: MutationOptions): Promise<T> {
        const repo = options?.manager?.getRepository(User) ?? this.rawRepo;

        if (await this.rawRepo.existsBy({ email: dto.email })) throw new UserAlreadyExistsException();

        const user    = repo.create();
        user.email    = dto.email;
        user.password = await hashPassword(dto.password);
        user.roleId   = dto.roleId;

        const saved = await repo.save(user);

        // Build DtoRepository from the same repo so the result is visible within any active transaction.
        const result = await new DtoRepository(repo).findOne({ dto: returnDto, where: { id: saved.id } });
        return result!;
    }

    async update<T>(returnDto: new () => T, id: number, dto: UpdateUserDto, options?: MutationOptions): Promise<T> {
        const repo = options?.manager?.getRepository(User) ?? this.rawRepo;

        const current = await this.findOneById(UserDto, id);

        if (dto.email && dto.email !== current.email) {
            if (await this.rawRepo.existsBy({ email: dto.email })) throw new UserAlreadyExistsException();
        }

        const payload: Record<string, any> = {};
        if (dto.email    !== undefined) payload.email    = dto.email;
        if (dto.roleId   !== undefined) payload.roleId   = dto.roleId;
        if (dto.password !== undefined) payload.password = await hashPassword(dto.password);

        await repo.update(id, payload);

        const result = await new DtoRepository(repo).findOne({ dto: returnDto, where: { id } });
        return result!;
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

    private async _findOne<T>(dto: new () => T, where: FindOptionsWhere<User>, throwException: boolean): Promise<T | null> {
        const result = await this.repo.findOne({ dto, where });
        if (!result && throwException) throw new UserNotFoundException();
        return result;
    }
}
