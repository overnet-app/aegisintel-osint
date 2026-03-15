import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ProxyConfig {
    host: string;
    port: number;
    username?: string;
    password?: string;
}

@Injectable()
export class ProxyManagerService {
    private readonly logger = new Logger(ProxyManagerService.name);
    private proxies: ProxyConfig[] = [];
    private currentIndex = 0;

    constructor(private configService: ConfigService) {
        this.loadProxies();
    }

    private loadProxies() {
        const proxyString = this.configService.get<string>('PROXY_LIST');
        if (proxyString) {
            try {
                this.proxies = JSON.parse(proxyString);
                this.logger.log(`Loaded ${this.proxies.length} proxies`);
            } catch (e) {
                this.logger.error('Failed to parse PROXY_LIST environment variable');
            }
        }
    }

    getNextProxy(): ProxyConfig | null {
        if (this.proxies.length === 0) return null;

        const proxy = this.proxies[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        return proxy;
    }

    getProxyUrl(proxy: ProxyConfig): string {
        const auth = proxy.username ? `${proxy.username}:${proxy.password}@` : '';
        return `http://${auth}${proxy.host}:${proxy.port}`;
    }
}
