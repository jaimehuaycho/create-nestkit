import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentEnum } from '../../shared/enums/index.js';

@Injectable()
export class AppConfig {
    readonly nodeEnv:        string;
    readonly port:           number;
    readonly apiPrefix:      string;
    readonly domainFrontend: string;
    readonly isProduction:   boolean;

    constructor(cfg: ConfigService) {
        this.nodeEnv        = cfg.get<string>('NODE_ENV')!;
        this.port           = cfg.get<number>('PORT')!;
        this.apiPrefix      = cfg.get<string>('API_PREFIX')!;
        this.domainFrontend = cfg.get<string>('DOMAIN_FRONTEND')!;
        this.isProduction   = this.nodeEnv === EnvironmentEnum.PRODUCTION;
    }
}
