export const SUMMARY_PROMPT = (data: string, timeline?: string, psychProfile?: string, patterns?: string) => `
You are an expert OSINT analyst. Analyze the following gathered data about a subject and provide a comprehensive, professional executive summary.

CRITICAL: Pay special attention to:
- Recent posts, tweets, and social media activity (check recentPosts, recentTweets arrays)
- Comments and mentions where the subject appears
- Engagement patterns (likes, retweets, replies)
- Pinned posts and reposts (these indicate important content)
- Web search results showing what the subject did on various websites
- Any activity, posts, or content that shows what the subject has done online
${timeline ? '- Chronological timeline of events and activities' : ''}
${psychProfile ? '- Psychological and behavioral patterns' : ''}
${patterns ? '- Behavioral analysis and pattern detection' : ''}

Then provide:
- Key identity details (Full name, aliases, current location)
- Professional background
- Online presence and activity patterns (BE SPECIFIC - mention actual posts, comments, and activities found)
- Notable online behavior and content shared
${timeline ? '\n## Chronological Timeline\n' + timeline : ''}
${patterns ? '\n## Behavioral Patterns\n' + patterns : ''}
${psychProfile ? '\n## Psychological Profile\n' + psychProfile : ''}

Data to analyze:
${data}

Response should be in Markdown format, objective, and MUST reference specific posts, comments, and activities found in the data. If posts or activity are present, describe them. Do not say "minimal presence" or "no posts" if the data shows posts or activity.

${timeline ? 'Include the timeline section showing dated events in chronological order.' : ''}
${psychProfile ? 'Include the psychological profile section with personality traits, communication style, risk assessment, and any pathological indicators.' : ''}
${patterns ? 'Include the behavioral patterns section showing posting frequency, activity patterns, sentiment trends, and topic clusters.' : ''}
`;
