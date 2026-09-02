import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ObserveConfig {
    readonly appKey:    string;
    readonly appSecret: string;
    readonly serviceId: string;

    constructor(cfg: ConfigService) {
        this.appKey    = cfg.get<string>('OBSERVE_APP_KEY', '')!;
        this.appSecret = cfg.get<string>('OBSERVE_APP_SECRET', '')!;
        this.serviceId = cfg.get<string>('OBSERVE_SERVICE_ID', 'app')!;
    }
}
