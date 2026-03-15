import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

export interface CookieData {
    name: string;
    value: string;
    domain: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
}

@Injectable()
export class AuthCookieService {
    private readonly logger = new Logger(AuthCookieService.name);
    private readonly encryptionKey: string;
    private readonly algorithm = 'aes-256-gcm';

    constructor(private prisma: PrismaService) {
        // Use environment variable for encryption key, or generate one (should be set in production)
        this.encryptionKey = process.env.COOKIE_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
        if (!process.env.COOKIE_ENCRYPTION_KEY) {
            this.logger.warn('COOKIE_ENCRYPTION_KEY not set, using temporary key. Set this in production!');
        }
    }

    /**
     * Encrypt cookie data
     */
    private encrypt(text: string): string {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(this.encryptionKey.slice(0, 32), 'hex'), iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    }

    /**
     * Decrypt cookie data
     */
    private decrypt(encryptedText: string): string {
        const parts = encryptedText.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format');
        }

        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];

        const decipher = crypto.createDecipheriv(this.algorithm, Buffer.from(this.encryptionKey.slice(0, 32), 'hex'), iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * Store cookies for a user and platform
     */
    async storeCookies(
        userId: string,
        platform: 'instagram' | 'facebook',
        cookies: CookieData[],
    ): Promise<void> {
        this.logger.log(`Storing ${cookies.length} cookies for user ${userId} on ${platform}`);

        try {
            const cookiesJson = JSON.stringify(cookies);
            const encrypted = this.encrypt(cookiesJson);

            // Store in user's thirdPartyKeys JSON field
            const user = await this.prisma.user.findUnique({ where: { id: userId } });
            const thirdPartyKeys = (user?.thirdPartyKeys as any) || {};

            thirdPartyKeys[`${platform}_cookies`] = encrypted;
            thirdPartyKeys[`${platform}_cookies_updated`] = new Date().toISOString();

            await this.prisma.user.update({
                where: { id: userId },
                data: { thirdPartyKeys },
            });

            this.logger.log(`Successfully stored cookies for ${platform}`);
        } catch (error) {
            this.logger.error(`Failed to store cookies: ${error.message}`);
            throw error;
        }
    }

    /**
     * Retrieve cookies for a user and platform
     */
    async getCookies(userId: string, platform: 'instagram' | 'facebook'): Promise<CookieData[]> {
        try {
            const user = await this.prisma.user.findUnique({ where: { id: userId } });
            if (!user) {
                return [];
            }

            const thirdPartyKeys = (user.thirdPartyKeys as any) || {};
            const encrypted = thirdPartyKeys[`${platform}_cookies`];

            if (!encrypted) {
                this.logger.warn(`No cookies found for user ${userId} on ${platform}`);
                return [];
            }

            const decrypted = this.decrypt(encrypted);
            const cookies = JSON.parse(decrypted) as CookieData[];

            // Check if cookies are expired
            const validCookies = cookies.filter(cookie => {
                if (cookie.expires && cookie.expires < Date.now() / 1000) {
                    return false;
                }
                return true;
            });

            if (validCookies.length < cookies.length) {
                this.logger.warn(`Some cookies expired, updating stored cookies`);
                await this.storeCookies(userId, platform, validCookies);
            }

            return validCookies;
        } catch (error) {
            this.logger.error(`Failed to retrieve cookies: ${error.message}`);
            return [];
        }
    }

    /**
     * Inject cookies into a Puppeteer page
     */
    async injectCookiesIntoPage(
        page: any,
        userId: string,
        platform: 'instagram' | 'facebook',
    ): Promise<boolean> {
        try {
            const cookies = await this.getCookies(userId, platform);
            if (cookies.length === 0) {
                this.logger.warn(`No cookies to inject for ${platform}`);
                return false;
            }

            // Convert to Puppeteer cookie format
            const puppeteerCookies = cookies.map(cookie => ({
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
                path: cookie.path || '/',
                expires: cookie.expires || Math.floor(Date.now() / 1000) + 86400, // Default 1 day
                httpOnly: cookie.httpOnly || false,
                secure: cookie.secure !== false,
                sameSite: cookie.sameSite || 'Lax',
            }));

            await page.setCookie(...puppeteerCookies);
            this.logger.log(`Injected ${puppeteerCookies.length} cookies into page for ${platform}`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to inject cookies: ${error.message}`);
            return false;
        }
    }

    /**
     * Extract cookies from a Puppeteer page and store them
     */
    async extractAndStoreCookies(
        page: any,
        userId: string,
        platform: 'instagram' | 'facebook',
    ): Promise<void> {
        try {
            const puppeteerCookies = await page.cookies();
            
            const cookies: CookieData[] = puppeteerCookies.map((cookie: any) => ({
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
                path: cookie.path,
                expires: cookie.expires,
                httpOnly: cookie.httpOnly,
                secure: cookie.secure,
                sameSite: cookie.sameSite,
            }));

            await this.storeCookies(userId, platform, cookies);
            this.logger.log(`Extracted and stored ${cookies.length} cookies from ${platform}`);
        } catch (error) {
            this.logger.error(`Failed to extract cookies: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check if user has valid cookies for a platform
     */
    async hasValidCookies(userId: string, platform: 'instagram' | 'facebook'): Promise<boolean> {
        const cookies = await this.getCookies(userId, platform);
        return cookies.length > 0;
    }

    /**
     * Delete stored cookies for a platform
     */
    async deleteCookies(userId: string, platform: 'instagram' | 'facebook'): Promise<void> {
        try {
            const user = await this.prisma.user.findUnique({ where: { id: userId } });
            if (!user) return;

            const thirdPartyKeys = (user.thirdPartyKeys as any) || {};
            delete thirdPartyKeys[`${platform}_cookies`];
            delete thirdPartyKeys[`${platform}_cookies_updated`];

            await this.prisma.user.update({
                where: { id: userId },
                data: { thirdPartyKeys },
            });

            this.logger.log(`Deleted cookies for ${platform}`);
        } catch (error) {
            this.logger.error(`Failed to delete cookies: ${error.message}`);
            throw error;
        }
    }
}
