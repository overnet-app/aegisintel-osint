import { Module, Global } from '@nestjs/common';
import { PuppeteerClusterService } from './puppeteer-cluster.service';
import { ProxyManagerService } from './proxy-manager.service';
import { RateLimiterService } from './rate-limiter.service';
import { ProxyRotationService } from './proxy-rotation.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { GenericScraper } from './generic.scraper';
import { InstagramScraper } from './instagram.scraper';
import { TwitterScraper } from './twitter.scraper';
import { LinkedInScraper } from './linkedin.scraper';
import { FacebookScraper } from './facebook.scraper';
import { TikTokScraper } from './tiktok.scraper';
import { AuthCookieService } from './auth-cookie.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
    imports: [PrismaModule],
    providers: [
        PuppeteerClusterService,
        ProxyManagerService,
        RateLimiterService,
        ProxyRotationService,
        CircuitBreakerService,
        GenericScraper,
        InstagramScraper,
        TwitterScraper,
        LinkedInScraper,
        FacebookScraper,
        TikTokScraper,
        AuthCookieService,
    ],
    exports: [
        PuppeteerClusterService,
        ProxyManagerService,
        RateLimiterService,
        ProxyRotationService,
        CircuitBreakerService,
        GenericScraper,
        InstagramScraper,
        TwitterScraper,
        LinkedInScraper,
        FacebookScraper,
        TikTokScraper,
        AuthCookieService,
    ],
})
export class ScraperModule { }
