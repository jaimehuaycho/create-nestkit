import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailCode } from './entities/email-code.entity.js';
import { EmailCodesService } from './services/email-codes.service.js';

// Data only: the table of e-mailed codes. Issuing and checking them lives in app/auth (EmailCodesService).
@Module({
    imports:   [TypeOrmModule.forFeature([EmailCode])],
    providers: [EmailCodesService],
    exports:   [EmailCodesService],
})
export class EmailCodesModule {}
