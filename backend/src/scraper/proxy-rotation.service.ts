import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ProxyRotationService {
    private readonly logger = new Logger(ProxyRotationService.name);
    private proxies: string[] = [];
    private currentIndex = 0;

    constructor(private configService: ConfigService) {
        const proxyList = this.configService.get<string>('PROXY_LIST');
        if (proxyList) {
            this.proxies = proxyList.split(',');
            this.logger.log(`Initialized with ${this.proxies.length} proxies`);
        }
    }

    getNextProxy(): string | null {
        if (this.proxies.length === 0) return null;
        const proxy = this.proxies[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        return proxy;
    }

    handleProxyFailure(proxy: string) {
        this.logger.warn(`Proxy failure detected: ${proxy}`);
        // Logic to temporarily disable or remove failing proxies could go here
    }
}
