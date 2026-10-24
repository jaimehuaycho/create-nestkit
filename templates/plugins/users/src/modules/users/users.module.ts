import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity.js';
import { Role } from '../roles/entities/role.entity.js';
import { UsersService } from './services/users.service.js';
import { UsersController } from './controllers/users.controller.js';

@Module({
    imports:     [TypeOrmModule.forFeature([User, Role])],
    controllers: [UsersController],
    providers:   [UsersService],
    exports:     [UsersService],
})
export class UsersModule {}
