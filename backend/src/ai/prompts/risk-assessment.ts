export const RISK_ASSESSMENT_PROMPT = (data: string) => `
You are a senior security researcher and threat intelligence analyst.
Analyze the following OSINT data for potential risks, data leaks, or suspicious activity.

Determine:
1. Risk Level (LOW, MEDIUM, HIGH, CRITICAL)
2. Specific findings (list of concerning items)
3. A brief explanation of the assessment

Data:
${data}

Return ONLY a valid JSON object with the following structure:
{
    "riskLevel": "...",
    "findings": ["...", "..."],
    "explanation": "..."
}
`;
