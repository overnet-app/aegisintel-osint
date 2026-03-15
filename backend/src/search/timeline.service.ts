import { Injectable, Logger } from '@nestjs/common';

export interface TimelineEvent {
    date: Date;
    platform: string;
    type: 'post' | 'comment' | 'article' | 'mention' | 'activity' | 'document';
    description: string;
    url?: string;
    author?: string;
    context?: string;
    source: string;
}

@Injectable()
export class TimelineService {
    private readonly logger = new Logger(TimelineService.name);

    /**
     * Build timeline from various data sources
     */
    buildTimeline(data: {
        socialMedia?: any[];
        webMentions?: any[];
        documents?: any[];
        comments?: any[];
    }): TimelineEvent[] {
        const events: TimelineEvent[] = [];

        // Extract events from social media posts
        if (data.socialMedia) {
            for (const platformData of data.socialMedia) {
                const platform = platformData.platform || 'unknown';
                
                // Extract posts with timestamps
                if (platformData.recentPosts) {
                    for (const post of platformData.recentPosts) {
                        if (post.timestamp || post.date) {
                            const date = post.timestamp ? new Date(post.timestamp) : new Date(post.date);
                            if (!isNaN(date.getTime())) {
                                events.push({
                                    date,
                                    platform,
                                    type: 'post',
                                    description: this.formatPostDescription(platformData.username || platformData.subject, post),
                                    url: post.url,
                                    author: platformData.username || platformData.subject,
                                    context: post.caption || post.text,
                                    source: platform,
                                });
                            }
                        }
                    }
                }

                // Extract comments with timestamps
                if (platformData.recentPosts) {
                    for (const post of platformData.recentPosts) {
                        if (post.comments && Array.isArray(post.comments)) {
                            for (const comment of post.comments) {
                                if (comment.timestamp) {
                                    const date = new Date(comment.timestamp);
                                    if (!isNaN(date.getTime())) {
                                        events.push({
                                            date,
                                            platform,
                                            type: 'comment',
                                            description: this.formatCommentDescription(
                                                comment.author || 'Unknown',
                                                comment.text,
                                                post.caption || post.text || 'a post',
                                            ),
                                            url: post.url,
                                            author: comment.author,
                                            context: comment.text,
                                            source: platform,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Extract events from web mentions
        if (data.webMentions) {
            for (const mention of data.webMentions) {
                if (mention.timestamp || mention.publishDate) {
                    const date = mention.timestamp ? new Date(mention.timestamp) : new Date(mention.publishDate);
                    if (!isNaN(date.getTime())) {
                        events.push({
                            date,
                            platform: 'web',
                            type: 'mention',
                            description: this.formatMentionDescription(mention),
                            url: mention.url,
                            context: mention.context?.before + ' ' + mention.text + ' ' + mention.context?.after,
                            source: mention.source || 'web',
                        });
                    }
                }
            }
        }

        // Extract events from documents
        if (data.documents) {
            for (const doc of data.documents) {
                if (doc.publishDate || doc.date) {
                    const date = doc.publishDate ? new Date(doc.publishDate) : new Date(doc.date);
                    if (!isNaN(date.getTime())) {
                        events.push({
                            date,
                            platform: 'document',
                            type: 'document',
                            description: `Document "${doc.title}" published`,
                            url: doc.url,
                            context: doc.snippet || doc.description,
                            source: doc.source || 'document',
                        });
                    }
                }
            }
        }

        // Extract events from standalone comments
        if (data.comments) {
            for (const comment of data.comments) {
                if (comment.timestamp) {
                    const date = new Date(comment.timestamp);
                    if (!isNaN(date.getTime())) {
                        events.push({
                            date,
                            platform: comment.platform || 'web',
                            type: 'comment',
                            description: `${comment.author} commented: "${comment.text.substring(0, 100)}${comment.text.length > 100 ? '...' : ''}"`,
                            url: comment.url,
                            author: comment.author,
                            context: comment.text,
                            source: comment.platform || 'web',
                        });
                    }
                }
            }
        }

        // Sort by date (oldest first)
        events.sort((a, b) => a.date.getTime() - b.date.getTime());

        this.logger.log(`Built timeline with ${events.length} events`);
        return events;
    }

    /**
     * Format post description for timeline
     */
    private formatPostDescription(author: string, post: any): string {
        const text = post.caption || post.text || '';
        const preview = text.length > 100 ? text.substring(0, 100) + '...' : text;
        return `${author} posted: "${preview}"`;
    }

    /**
     * Format comment description for timeline
     */
    private formatCommentDescription(author: string, commentText: string, postContext: string): string {
        const preview = commentText.length > 80 ? commentText.substring(0, 80) + '...' : commentText;
        return `${author} commented on "${postContext.substring(0, 50)}${postContext.length > 50 ? '...' : ''}": "${preview}"`;
    }

    /**
     * Format mention description for timeline
     */
    private formatMentionDescription(mention: any): string {
        const source = mention.source || 'an article';
        const context = mention.context?.before || mention.context?.after || '';
        const preview = context.length > 60 ? context.substring(0, 60) + '...' : context;
        return `Mentioned in ${source}: "${preview}"`;
    }

    /**
     * Format timeline as human-readable text
     */
    formatTimeline(events: TimelineEvent[]): string {
        if (events.length === 0) {
            return 'No timeline events found.';
        }

        const lines: string[] = [];
        lines.push('## Chronological Timeline\n');

        let currentDate: string | null = null;

        for (const event of events) {
            const eventDate = event.date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });

            if (eventDate !== currentDate) {
                lines.push(`\n### ${eventDate}\n`);
                currentDate = eventDate;
            }

            const time = event.date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
            });

            lines.push(`- **${time}** - ${event.description}`);
            if (event.url) {
                lines.push(`  - Source: ${event.url}`);
            }
            if (event.context) {
                const contextPreview = event.context.length > 150
                    ? event.context.substring(0, 150) + '...'
                    : event.context;
                lines.push(`  - Context: ${contextPreview}`);
            }
        }

        return lines.join('\n');
    }

    /**
     * Get timeline statistics
     */
    getTimelineStats(events: TimelineEvent[]): {
        totalEvents: number;
        dateRange: { start: Date; end: Date } | null;
        eventsByPlatform: Record<string, number>;
        eventsByType: Record<string, number>;
    } {
        if (events.length === 0) {
            return {
                totalEvents: 0,
                dateRange: null,
                eventsByPlatform: {},
                eventsByType: {},
            };
        }

        const eventsByPlatform: Record<string, number> = {};
        const eventsByType: Record<string, number> = {};

        let earliest = events[0].date;
        let latest = events[0].date;

        for (const event of events) {
            if (event.date < earliest) earliest = event.date;
            if (event.date > latest) latest = event.date;

            eventsByPlatform[event.platform] = (eventsByPlatform[event.platform] || 0) + 1;
            eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
        }

        return {
            totalEvents: events.length,
            dateRange: { start: earliest, end: latest },
            eventsByPlatform,
            eventsByType,
        };
    }
}
