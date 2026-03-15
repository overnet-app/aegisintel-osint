import { Injectable, Logger } from '@nestjs/common';
import { PuppeteerClusterService } from '../scraper/puppeteer-cluster.service';
import * as cheerio from 'cheerio';

export interface ProfilePreview {
    exists: boolean;
    username: string;
    platform: string;
    url: string;
    fullName?: string;
    avatarUrl?: string;
    bio?: string;
    stats?: { 
        followers?: string; 
        following?: string; 
        posts?: string;
        repos?: string;
        connections?: string;
        likes?: string;
    };
    recentPost?: { 
        text?: string; 
        imageUrl?: string; 
        caption?: string;
        timestamp?: string;
        url?: string;
    };
    location?: string;
    profession?: string;
    company?: string;
    professionKeywords?: string[];
    hashtags?: string[];
    detectedLanguage?: string;
}

@Injectable()
export class UsernameCheckerService {
    private readonly logger = new Logger(UsernameCheckerService.name);

    private readonly platforms = [
        { name: 'Instagram', url: 'https://www.instagram.com/{}', selector: 'header' },
        { name: 'Twitter', url: 'https://twitter.com/{}', selector: '[data-testid="UserName"]' },
        { name: 'LinkedIn', url: 'https://www.linkedin.com/in/{}', selector: '.pv-top-card' },
        { name: 'TikTok', url: 'https://www.tiktok.com/@{}', selector: '[data-e2e="user-title"]' },
        { name: 'GitHub', url: 'https://github.com/{}', selector: '.vcard-details' },
        { name: 'Reddit', url: 'https://www.reddit.com/user/{}', selector: '[id^="UserInfoTooltip"]' },
    ];

    constructor(private puppeteer: PuppeteerClusterService) { }

    async check(username: string): Promise<ProfilePreview[]> {
        // Normalize username: remove @ and spaces for direct handle check
        const normalizedUsername = username.replace(/[@\s]/g, '').toLowerCase();
        if (!normalizedUsername) return [];

        this.logger.log(`Checking username: ${normalizedUsername} across ${this.platforms.length} platforms`);

        const results = await Promise.all(
            this.platforms.map(async (platform) => {
                const url = platform.url.replace('{}', normalizedUsername);
                return this.checkUrlInternal(url, platform.name);
            })
        );

        return results.filter(r => r.exists);
    }

    async checkUrls(urls: string[]): Promise<ProfilePreview[]> {
        this.logger.log(`Verifying ${urls.length} discovered URLs`);
        const results = await Promise.all(
            urls.map(async (url) => {
                const platform = this.platforms.find(p => url.toLowerCase().includes(p.name.toLowerCase().replace('twitter', 'x.com'))) ||
                    this.platforms.find(p => url.toLowerCase().includes('x.com')) ||
                    { name: 'Other' };
                return this.checkUrlInternal(url, platform.name);
            })
        );
        return results.filter(r => r.exists);
    }

    private async checkUrlInternal(url: string, platformName: string): Promise<ProfilePreview> {
        try {
            return await this.puppeteer.execute(async (page) => {
                const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
                const exists = response?.status() === 200;

                if (!exists) {
                    const username = url.split('/').filter(Boolean).pop() || '';
                    return { platform: platformName, url, exists: false, username };
                }

                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait longer for content

                const html = await page.content();
                const $ = cheerio.load(html);
                const username = url.split('/').filter(Boolean).pop() || '';
                const metadata: ProfilePreview = { 
                    platform: platformName, 
                    url, 
                    exists: true,
                    username: username
                };

                // Enhanced extraction with stats and recent posts
                if (platformName === 'Instagram') {
                    metadata.fullName = $('header section h1').first().text() || $('header h2').text();
                    metadata.bio = $('header section').find('div').last().text().trim() || 
                                  $('header section span').first().text().trim();
                    metadata.avatarUrl = $('header img').attr('src') || $('img[alt*="profile picture"]').attr('src');
                    
                    // Extract location from bio (common pattern: "📍 Location" or "Location, Country")
                    const bioText = metadata.bio || '';
                    const locationMatch = bioText.match(/(?:📍|📌|📍|Location:?|Based in|From)\s*([^,\n]+(?:,\s*[^,\n]+)?)/i);
                    if (locationMatch) {
                        metadata.location = locationMatch[1].trim();
                    }
                    
                    // Extract hashtags as interests
                    const hashtags = bioText.match(/#[\w]+/g) || [];
                    metadata.hashtags = hashtags.map(tag => tag.substring(1));
                    
                    // Extract stats
                    const stats = $('header section ul li');
                    metadata.stats = {
                        posts: stats.eq(0).find('span').first().text().trim(),
                        followers: stats.eq(1).find('span').first().attr('title') || stats.eq(1).find('span').first().text().trim(),
                        following: stats.eq(2).find('span').first().text().trim(),
                    };
                    
                    // Extract most recent post preview
                    const firstPost = $('article div div div div a').first();
                    if (firstPost.length) {
                        const postUrl = firstPost.attr('href');
                        const postImg = firstPost.find('img').first();
                        metadata.recentPost = {
                            url: postUrl ? `https://www.instagram.com${postUrl}` : undefined,
                            imageUrl: postImg.attr('src'),
                            caption: postImg.attr('alt') || '',
                        };
                    }
                } else if (platformName === 'Twitter' || platformName.toLowerCase() === 'x') {
                    metadata.fullName = $('[data-testid="UserName"]').first().text().trim();
                    metadata.bio = $('[data-testid="UserDescription"]').text().trim();
                    metadata.avatarUrl = $('[data-testid="Avatar"] img').attr('src') || 
                                        $('img[alt*="profile"]').attr('src');
                    
                    // Extract location from Twitter
                    const location = $('[data-testid="UserLocation"]').text().trim() ||
                                    $('[data-testid="UserProfileHeader_Items"]').find('span').filter((i, el) => {
                                        const text = $(el).text().trim();
                                        return Boolean(text && !text.includes('@') && !text.includes('http') && text.length > 3);
                                    }).first().text().trim();
                    if (location) {
                        metadata.location = location;
                    }
                    
                    // Extract stats
                    const stats = $('[data-testid="UserName"]').parent().find('a');
                    metadata.stats = {
                        following: stats.eq(0).text().trim(),
                        followers: stats.eq(1).text().trim(),
                    };
                    
                    // Extract most recent tweet
                    const firstTweet = $('article[data-testid="tweet"]').first();
                    if (firstTweet.length) {
                        metadata.recentPost = {
                            text: firstTweet.find('[data-testid="tweetText"]').text().trim(),
                            timestamp: firstTweet.find('time').attr('datetime'),
                        };
                    }
                } else if (platformName === 'LinkedIn') {
                    metadata.fullName = $('.pv-text-details__left-panel h1').text().trim() ||
                                      $('.ph5 h1').text().trim();
                    metadata.bio = $('.pv-text-details__left-panel .text-body-medium').text().trim() ||
                                 $('.ph5 .text-body-medium').text().trim();
                    metadata.avatarUrl = $('.pv-top-card-profile-picture__image').attr('src') ||
                                       $('img[alt*="profile"]').attr('src');
                    
                    // Extract location and profession from LinkedIn
                    const headline = $('.pv-text-details__left-panel .text-body-medium').first().text().trim() ||
                                   $('.ph5 .text-body-medium').first().text().trim();
                    const location = $('.pv-text-details__left-panel .text-body-small').text().trim() ||
                                   $('.ph5 .text-body-small').text().trim();
                    
                    metadata.location = location;
                    metadata.profession = headline;
                    
                    // Extract stats
                    const connections = $('.pv-top-card-v2-section__connections').text().trim();
                    metadata.stats = {
                        connections: connections,
                    };
                } else if (platformName === 'GitHub') {
                    metadata.fullName = $('.vcard-fullname').text().trim();
                    metadata.bio = $('.user-profile-bio').text().trim();
                    metadata.avatarUrl = $('.avatar-user').attr('src');
                    
                    // Extract location from GitHub
                    const location = $('.vcard-details .p-label').filter((i, el) => {
                        const text = $(el).text().trim();
                        return Boolean(text && !text.includes('@') && !text.includes('http'));
                    }).first().text().trim();
                    metadata.location = location;
                    
                    // Extract company/organization
                    const company = $('.vcard-details .p-org').text().trim();
                    if (company) {
                        metadata.company = company;
                    }
                    
                    // Extract stats
                    const stats = $('.vcard-stats a');
                    metadata.stats = {
                        repos: stats.eq(0).find('.Counter').text().trim(),
                        followers: stats.eq(1).find('.Counter').text().trim(),
                        following: stats.eq(2).find('.Counter').text().trim(),
                    };
                } else if (platformName === 'Reddit') {
                    metadata.fullName = $('h1').first().text().trim();
                    metadata.bio = $('[data-testid="user-description"]').text().trim();
                    metadata.avatarUrl = $('img[alt="User avatar"]').attr('src');
                    
                    // Check if user exists (Reddit shows error message if not)
                    if ($('h1').text().includes('Sorry, nobody')) {
                        return { platform: platformName, url, exists: false, username };
                    }
                } else if (platformName === 'TikTok') {
                    metadata.fullName = $('[data-e2e="user-subtitle"]').text().trim() || 
                                      $('[data-e2e="user-title"]').text().trim();
                    metadata.bio = $('[data-e2e="user-bio"]').text().trim();
                    metadata.avatarUrl = $('[data-e2e="user-avatar"] img').attr('src') || 
                                       $('header img').attr('src');
                    
                    // Extract stats
                    const stats = $('[data-e2e="followers-count"], [data-e2e="following-count"], [data-e2e="likes-count"]');
                    metadata.stats = {
                        followers: $('[data-e2e="followers-count"]').text().trim(),
                        following: $('[data-e2e="following-count"]').text().trim(),
                        likes: $('[data-e2e="likes-count"]').text().trim(),
                    };
                }

                // Extract profession keywords from bio across all platforms
                const bioText = (metadata.bio || '').toLowerCase();
                const professionKeywords = [
                    'developer', 'engineer', 'programmer', 'coder', 'software',
                    'musician', 'guitarist', 'singer', 'composer', 'artist',
                    'painter', 'designer', 'photographer', 'writer',
                    'professor', 'researcher', 'academic', 'phd',
                    'ceo', 'cto', 'founder', 'manager', 'director'
                ];
                
                const foundProfessions = professionKeywords.filter(keyword => bioText.includes(keyword));
                if (foundProfessions.length > 0) {
                    metadata.professionKeywords = foundProfessions;
                }

                // Detect language from bio (simple heuristic)
                const romanianWords = ['și', 'sunt', 'am', 'este', 'românia', 'român'];
                const spanishWords = ['y', 'es', 'soy', 'tengo', 'españa', 'español'];
                const frenchWords = ['et', 'est', 'je', 'suis', 'france', 'français'];
                
                const bioLower = bioText.toLowerCase();
                if (romanianWords.some(word => bioLower.includes(word))) {
                    metadata.detectedLanguage = 'Romanian';
                } else if (spanishWords.some(word => bioLower.includes(word))) {
                    metadata.detectedLanguage = 'Spanish';
                } else if (frenchWords.some(word => bioLower.includes(word))) {
                    metadata.detectedLanguage = 'French';
                }

                return metadata;
            });
        } catch (error) {
            this.logger.warn(`Failed to check ${url}: ${error.message}`);
            const username = url.split('/').filter(Boolean).pop() || '';
            return { platform: platformName, url, exists: false, username };
        }
    }
}
