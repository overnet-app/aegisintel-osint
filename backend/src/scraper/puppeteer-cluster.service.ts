import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createPool, Pool } from 'generic-pool';
import { Browser, Page } from 'puppeteer';
import { ProxyRotationService } from './proxy-rotation.service';

puppeteer.use(StealthPlugin());

@Injectable()
export class PuppeteerClusterService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PuppeteerClusterService.name);
    private pool: Pool<Browser>;

    // Realistic user agents for rotation
    private readonly userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    ];

    constructor(
        private configService: ConfigService,
        private proxyRotation: ProxyRotationService,
    ) { }

    async onModuleInit() {
        this.logger.log('Initializing Puppeteer browser pool...');

        const factory = {
            create: async () => {
                this.logger.debug('Creating new browser instance');
                return await puppeteer.launch({
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--disable-gpu',
                        '--window-size=1920,1080',
                        '--disable-blink-features=AutomationControlled',
                    ],
                });
            },
            destroy: async (browser: Browser) => {
                this.logger.debug('Destroying browser instance');
                await browser.close();
            },
            validate: async (browser: Browser) => {
                return browser.connected;
            }
        };

        const opts = {
            max: this.configService.get<number>('PUPPETEER_MAX_BROWSERS') || 3,
            min: this.configService.get<number>('PUPPETEER_MIN_BROWSERS') || 1,
            testOnBorrow: true,
            autostart: true,
        };

        this.pool = createPool(factory, opts);
    }

    async onModuleDestroy() {
        this.logger.log('Shutting down Puppeteer browser pool...');
        await this.pool.drain();
        await this.pool.clear();
    }

    private getRandomUserAgent(): string {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    async execute<T>(task: (page: Page) => Promise<T>, proxy?: string, platform?: string): Promise<T> {
        // Get proxy if not provided and proxy rotation is available
        const finalProxy = proxy || this.proxyRotation.getNextProxy();
        
        const browser = await this.pool.acquire();
        let context;
        
        try {
            // Create context with proxy if available
            if (finalProxy) {
                const proxyUrl = finalProxy.startsWith('http') ? finalProxy : `http://${finalProxy}`;
                context = await browser.createBrowserContext({
                    proxyServer: proxyUrl,
                });
                this.logger.debug(`Using proxy for task: ${finalProxy}`);
            } else {
                context = await browser.createBrowserContext();
            }
            
            const page = await context.newPage();

            try {
                await page.setViewport({ width: 1920, height: 1080 });

                // Rotate user agents
                const userAgent = this.getRandomUserAgent();
                await page.setUserAgent(userAgent);

                // Set extra headers to appear more human
                await page.setExtraHTTPHeaders({
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                });

                // Override webdriver detection
                await page.evaluateOnNewDocument(() => {
                    Object.defineProperty(navigator, 'webdriver', { get: () => false });
                    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
                    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                });

                return await task(page);
            } finally {
                await page.close();
            }
        } finally {
            if (context) {
                await context.close();
            }
            await this.pool.release(browser);
        }
    }
}
