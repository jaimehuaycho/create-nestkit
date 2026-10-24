import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { RefreshTokensService } from './services/refresh-tokens.service.js';

// Data only: the table of refresh-token families. Rotation and reuse detection live in app/auth (SessionsService).
@Module({
    imports: [TypeOrmModule.forFeature([RefreshToken])],
    providers: [RefreshTokensService],
    exports:   [RefreshTokensService],
})
export class RefreshTokensModule {}
