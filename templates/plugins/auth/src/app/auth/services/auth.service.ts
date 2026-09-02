import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../../modules/users/services/users.service.js';
import { UserDto } from '../../../modules/users/dto/user.dto.js';
import { UserForAuthDto } from '../../../modules/users/dto/user-for-auth.dto.js';
import { JwtConfig } from '../config/jwt.config.js';
import { LoginDto } from '../dto/login.dto.js';
import { RegisterDto } from '../dto/register.dto.js';
import { RefreshDto } from '../dto/refresh.dto.js';
import { AuthResponseDto } from '../dto/auth-response.dto.js';
import { JwtPayload } from '../strategies/jwt.strategy.js';
import { InvalidCredentialsException, InvalidRefreshTokenException } from '../exceptions/index.js';
import { comparePassword, hashPassword } from '../../../shared/utils/crypto.util.js';

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService:   JwtService,
        private readonly jwtConfig:    JwtConfig,
    ) {}

    async login(dto: LoginDto): Promise<AuthResponseDto> {
        const user = await this.usersService.findOneByEmail(UserForAuthDto, dto.email, { throwException: false });

        if (!user) throw new InvalidCredentialsException();

        const passwordMatch = await comparePassword(dto.password, user.password);
        if (!passwordMatch) throw new InvalidCredentialsException();

        const payload: JwtPayload = { sub: user.id, email: user.email, roleId: user.roleId };
        const { accessToken, refreshToken } = await this.buildTokens(payload);

        const userDto = await this.usersService.findOneById(UserDto, user.id);
        return { accessToken, refreshToken, user: userDto };
    }

    async register(dto: RegisterDto): Promise<AuthResponseDto> {
        const userDto = await this.usersService.create(UserDto, {
            email:    dto.email,
            password: dto.password,
            roleId:   dto.roleId,
        });

        const payload: JwtPayload = { sub: userDto.id, email: userDto.email, roleId: userDto.role.id };
        const { accessToken, refreshToken } = await this.buildTokens(payload);

        return { accessToken, refreshToken, user: userDto };
    }

    async refresh(dto: RefreshDto): Promise<AuthResponseDto> {
        let payload: JwtPayload;
        try {
            payload = this.jwtService.verify<JwtPayload>(dto.refreshToken, {
                secret: this.jwtConfig.refreshSecret,
            });
        } catch {
            throw new InvalidRefreshTokenException();
        }

        const user = await this.usersService.findOneById(UserForAuthDto, payload.sub, { throwException: false });

        if (!user || !user.refreshToken) throw new InvalidRefreshTokenException();

        const tokenMatches = await comparePassword(dto.refreshToken, user.refreshToken);

        if (!tokenMatches) {
            // Hash mismatch may indicate refresh token reuse — revoke all sessions.
            await this.usersService.setRefreshToken(user.id, null);
            throw new InvalidRefreshTokenException();
        }

        const newPayload: JwtPayload = { sub: user.id, email: user.email, roleId: user.roleId };
        const { accessToken, refreshToken } = await this.buildTokens(newPayload);

        const userDto = await this.usersService.findOneById(UserDto, user.id);
        return { accessToken, refreshToken, user: userDto };
    }

    async logout(userId: number): Promise<void> {
        await this.usersService.setRefreshToken(userId, null);
    }

    private async buildTokens(payload: JwtPayload): Promise<{ accessToken: string; refreshToken: string }> {
        const accessToken = this.jwtService.sign(payload);

        const refreshToken = this.jwtService.sign(payload, {
            secret:    this.jwtConfig.refreshSecret,
            expiresIn: this.jwtConfig.refreshExpiresIn as any,
        });

        // Never store refresh tokens in plain text — treat them like passwords.
        const hashed = await hashPassword(refreshToken);
        await this.usersService.setRefreshToken(payload.sub, hashed);

        return { accessToken, refreshToken };
    }
}
