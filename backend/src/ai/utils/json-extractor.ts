export function extractJson<T>(response: string): T | null {
    const patterns = [
        /```json\s*([\s\S]*?)```/,
        /```\s*([\s\S]*?)```/,
        /\{[\s\S]*\}/,
    ];

    for (const pattern of patterns) {
        const match = response.match(pattern);
        if (match) {
            try {
                const jsonString = match[1] || match[0];
                // Find the first { and last } to extract JSON
                const start = jsonString.indexOf('{');
                const end = jsonString.lastIndexOf('}');
                if (start !== -1 && end !== -1 && end > start) {
                    return JSON.parse(jsonString.substring(start, end + 1)) as T;
                }
                return JSON.parse(jsonString) as T;
            } catch {
                // Continue to next pattern
            }
        }
    }

    return null;
}
