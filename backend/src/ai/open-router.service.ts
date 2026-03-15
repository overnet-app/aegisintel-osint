import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../common/services/cache.service';
import * as crypto from 'crypto';

export enum AiModel {
    // Free tier models
    NVIDIA_NEMOTRON_NANO_9B_V2 = 'nvidia/nemotron-nano-9b-v2:free',
    ARCEE_TRINITY_MINI = 'arcee-ai/trinity-mini:free',
    QWEN3_4B = 'qwen/qwen3-4b:free',
    LLAMA_32_3B_INSTRUCT = 'meta-llama/llama-3.2-3b-instruct:free',
    QWEN25_VL_7B_INSTRUCT = 'qwen/qwen-2.5-vl-7b-instruct:free',
    GOOGLE_GEMMA_3N_2B = 'google/gemma-3n-2b-it:free',
    GOOGLE_GEMMA_3_4B = 'google/gemma-3-4b-it:free',
    GOOGLE_GEMMA_3_12B_FREE = 'google/gemma-3-12b-it:free',
    GOOGLE_GEMMA_3N_4B = 'google/gemma-3n-4b-it:free',
    MOONSHOT_KIMI_K2 = 'moonshotai/kimi-k2:free',
    ZAI_GLM_45_AIR_FREE = 'z-ai/glm-4.5-air:free',
    DEEPSEEK_R1 = 'deepseek/deepseek-r1-0528:free',
    LLAMA_33_70B = 'meta-llama/llama-3.3-70b-instruct:free',
    DOLPHIN_VENICE = 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
    GPT_OSS_120B_FREE = 'openai/gpt-oss-120b:free',
    GPT_OSS_20B_FREE = 'openai/gpt-oss-20b:free',

    // Paid / non-free variants the user may choose explicitly
    GPT_OSS_20B = 'openai/gpt-oss-20b',
    GOOGLE_GEMMA_3_12B = 'google/gemma-3-12b-it',
    GOOGLE_GEMMA_3_27B = 'google/gemma-3-27b-it',
    DEEPSEEK_R1_LLAMA_70B = 'deepseek/deepseek-r1-distill-llama-70b',
    GPT_OSS_120B = 'openai/gpt-oss-120b',
    ZAI_GLM_45_AIR = 'z-ai/glm-4.5-air',
    QWEN3_30B_A3B = 'qwen/qwen3-30b-a3b',

    // Premium models - OpenAI
    GPT_4O = 'openai/gpt-4o',
    GPT_4O_MINI = 'openai/gpt-4o-mini',
    GPT_4_TURBO = 'openai/gpt-4-turbo',
    O1_PREVIEW = 'openai/o1-preview',
    O1_MINI = 'openai/o1-mini',

    // Premium models - Anthropic
    CLAUDE_3_5_SONNET = 'anthropic/claude-3.5-sonnet',
    CLAUDE_3_OPUS = 'anthropic/claude-3-opus',
    CLAUDE_3_5_HAIKU = 'anthropic/claude-3.5-haiku',

    // Premium models - Google
    GEMINI_1_5_PRO = 'google/gemini-1.5-pro',
    GEMINI_1_5_FLASH = 'google/gemini-1.5-flash',
}

export interface OpenRouterModel {
    id: string;
    name: string;
    description?: string;
    pricing?: {
        prompt: string;
        completion: string;
    };
    context_length?: number;
    architecture?: {
        modality?: string;
        tokenizer?: string;
        instruct_type?: string;
    };
    top_provider?: {
        max_completion_tokens?: number | null;
        is_moderated?: boolean;
    };
    per_request_limits?: {
        prompt_tokens?: string;
        completion_tokens?: string;
    };
}

export interface ProcessedModel {
    id: string;
    name: string;
    provider: string;
    description: string;
    tier: 'free' | 'paid';
    contextLength?: number;
    modality?: string;
    supportsVision: boolean;
}

export interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: {
            type: 'object';
            properties: Record<string, any>;
            required?: string[];
        };
    };
}

export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

export interface ToolCallResult {
    toolCallId: string;
    role: 'tool';
    name: string;
    content: string;
}

export interface StructuredOutputSchema {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
}

@Injectable()
export class OpenRouterService {
    private readonly logger = new Logger(OpenRouterService.name);
    private readonly apiKey: string;
    private readonly apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    private readonly modelsUrl = 'https://openrouter.ai/api/v1/models';

    // Model fallback chain: try in order if one fails
    private readonly fallbackChain = [
        'google/gemma-3-4b-it:free',
        'qwen/qwen3-4b:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'nvidia/nemotron-nano-9b-v2:free',
    ];

    constructor(
        private configService: ConfigService,
        private cache: CacheService,
    ) {
        this.apiKey = this.configService.get<string>('OPENROUTER_API_KEY')!;
    }

    async complete(prompt: string, model: AiModel | string = 'google/gemma-3-4b-it:free', useFallback: boolean = true): Promise<string> {
        // Check cache first
        const cacheKey = `ai:${crypto.createHash('md5').update(prompt + model).digest('hex')}`;
        const cached = await this.cache.get<string>(cacheKey);
        if (cached) {
            this.logger.debug('Returning cached AI response');
            return cached;
        }

        // If fallback disabled, use only the specified model
        if (!useFallback) {
            try {
                const result = await this.completeWithRetry(prompt, model, 3);
                await this.cache.set(cacheKey, result, 3600);
                return result;
            } catch (error) {
                this.logger.error(`Model ${model} failed and fallback is disabled`);
                throw error;
            }
        }

        // Try the requested model first, then fallback chain
        const modelsToTry = [model, ...this.fallbackChain.filter(m => m !== model)];

        for (const currentModel of modelsToTry) {
            try {
                const result = await this.completeWithRetry(prompt, currentModel, 3);
                // Cache for 1 hour
                await this.cache.set(cacheKey, result, 3600);
                return result;
            } catch (error) {
                this.logger.warn(`Model ${currentModel} failed, trying next fallback...`);
            }
        }

        throw new Error('All models in fallback chain failed');
    }

    private async completeWithRetry(prompt: string, model: string, maxRetries: number): Promise<string> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await this.makeRequest(prompt, model);
            } catch (error) {
                lastError = error;
                const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff, max 10s
                this.logger.warn(`Attempt ${attempt + 1}/${maxRetries} failed for ${model}. Retrying in ${delay}ms...`);
                await this.sleep(delay);
            }
        }

        throw lastError || new Error('Max retries exceeded');
    }

    private async makeRequest(prompt: string, model: string): Promise<string> {
        
        this.logger.log(`Requesting completion from OpenRouter using model: ${model}`);

        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'HTTP-Referer': this.configService.get<string>('FRONTEND_URL') || '',
                'X-Title': 'Aegis-Intel OSINT Platform',
                'Content-Type': 'application/json',
            } as any,
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
            }),
        });

        if (!response.ok) {
            
            const error = await response.json().catch(() => ({}));
            this.logger.error(`OpenRouter API error: ${JSON.stringify(error)}`);
            throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
        }
        

        const data = await response.json() as any;

        if (!data.choices?.[0]?.message?.content) {
            throw new Error('Invalid response structure from OpenRouter');
        }

        return data.choices[0].message.content;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Complete with function/tool calling support
     * @param prompt User prompt
     * @param tools Array of tool definitions
     * @param model Model to use (defaults to GPT-4o for best tool calling)
     * @param toolCallHandler Optional handler for tool calls (if not provided, returns tool calls)
     * @returns Response content or tool calls
     */
    async completeWithTools(
        prompt: string,
        tools: ToolDefinition[],
        model: AiModel | string = AiModel.GPT_4O,
        toolCallHandler?: (toolCalls: ToolCall[]) => Promise<ToolCallResult[]>,
    ): Promise<string | { toolCalls: ToolCall[]; toolResults?: ToolCallResult[] }> {
        this.logger.log(`Requesting completion with ${tools.length} tools from model: ${model}`);

        const messages: any[] = [{ role: 'user', content: prompt }];
        let maxIterations = 5; // Prevent infinite loops
        let iteration = 0;

        while (iteration < maxIterations) {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'HTTP-Referer': this.configService.get<string>('FRONTEND_URL') || '',
                    'X-Title': 'Aegis-Intel OSINT Platform',
                    'Content-Type': 'application/json',
                } as any,
                body: JSON.stringify({
                    model,
                    messages,
                    tools: tools.map(t => ({
                        type: t.type,
                        function: t.function,
                    })),
                    tool_choice: 'auto', // Let model decide when to use tools
                }),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                this.logger.error(`OpenRouter API error: ${JSON.stringify(error)}`);
                throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as any;
            const message = data.choices?.[0]?.message;

            if (!message) {
                throw new Error('Invalid response structure from OpenRouter');
            }

            // Add assistant message to conversation
            messages.push(message);

            // Check if model wants to call tools
            if (message.tool_calls && message.tool_calls.length > 0) {
                const toolCalls: ToolCall[] = message.tool_calls;

                if (!toolCallHandler) {
                    // Return tool calls if no handler provided
                    return { toolCalls };
                }

                // Execute tool calls
                const toolResults = await toolCallHandler(toolCalls);

                // Add tool results to conversation
                messages.push(...toolResults.map(result => ({
                    role: result.role,
                    tool_call_id: result.toolCallId,
                    name: result.name,
                    content: result.content,
                })));

                iteration++;
                continue; // Continue conversation with tool results
            }

            // Model returned final answer
            return message.content || '';
        }

        throw new Error('Maximum tool calling iterations reached');
    }

    /**
     * Complete with structured output using JSON schema
     * @param prompt User prompt
     * @param schema JSON schema for structured output
     * @param model Model to use (defaults to Claude 3.5 Sonnet for reliable structured output)
     * @returns Parsed structured output
     */
    async completeWithSchema<T>(
        prompt: string,
        schema: StructuredOutputSchema,
        model: AiModel | string = AiModel.GOOGLE_GEMMA_3_27B, // Default fallback only if no model provided
    ): Promise<T> {
        this.logger.log(`Requesting structured output from model: ${model}`);

        // Check cache
        const cacheKey = `ai:structured:${crypto.createHash('md5').update(prompt + model + JSON.stringify(schema)).digest('hex')}`;
        const cached = await this.cache.get<T>(cacheKey);
        if (cached) {
            this.logger.debug('Returning cached structured output');
            return cached;
        }

        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'HTTP-Referer': this.configService.get<string>('FRONTEND_URL') || '',
                'X-Title': 'Aegis-Intel OSINT Platform',
                'Content-Type': 'application/json',
            } as any,
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'structured_output',
                        strict: true,
                        schema: {
                            type: 'object',
                            properties: schema.properties,
                            required: schema.required || [],
                            additionalProperties: schema.additionalProperties !== false,
                        },
                    },
                },
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            this.logger.error(`OpenRouter API error: ${JSON.stringify(error)}`);
            throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as any;
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('Invalid response structure from OpenRouter');
        }

        try {
            // Parse JSON response
            const parsed = typeof content === 'string' ? JSON.parse(content) : content;
            
            // Cache for 1 hour
            await this.cache.set(cacheKey, parsed, 3600);
            
            return parsed as T;
        } catch (parseError: any) {
            this.logger.error(`Failed to parse structured output: ${parseError.message}`);
            throw new Error(`Failed to parse structured output: ${parseError.message}`);
        }
    }

    async analyzeImage(imageUrl: string, prompt: string): Promise<string> {
        this.logger.log(`Requesting image analysis from OpenRouter`);

        try {
            // Check if URL is localhost/private - OpenRouter cannot access these
            const isLocalhost = imageUrl.includes('localhost') || 
                               imageUrl.includes('127.0.0.1') || 
                               imageUrl.includes('192.168.') ||
                               imageUrl.includes('10.') ||
                               imageUrl.startsWith('http://localhost') ||
                               imageUrl.startsWith('http://127.0.0.1');

            let imageDataUrl = imageUrl;

            // If localhost, download and convert to base64
            if (isLocalhost) {
                this.logger.log(`Converting localhost image to base64: ${imageUrl}`);
                try {
                    const imageResponse = await fetch(imageUrl);
                    if (!imageResponse.ok) {
                        throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
                    }
                    const imageBuffer = await imageResponse.arrayBuffer();
                    const base64 = Buffer.from(imageBuffer).toString('base64');
                    
                    // Determine MIME type from URL or response
                    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
                    imageDataUrl = `data:${contentType};base64,${base64}`;
                    this.logger.log(`Successfully converted image to base64 (${base64.length} chars)`);
                } catch (fetchError: any) {
                    this.logger.error(`Failed to convert localhost image to base64: ${fetchError.message}`);
                    throw new Error(`Cannot access localhost image: ${fetchError.message}`);
                }
            }

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'HTTP-Referer': this.configService.get<string>('FRONTEND_URL') || '',
                    'X-Title': 'Aegis-Intel OSINT Platform',
                    'Content-Type': 'application/json',
                } as any,
                body: JSON.stringify({
                    model: 'google/gemma-3-4b-it:free', // Vision-capable free model
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: prompt },
                                { type: 'image_url', image_url: { url: imageDataUrl } },
                            ],
                        },
                    ],
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = response.statusText;
                
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.error?.message || errorData.message || response.statusText;
                } catch {
                    errorMessage = errorText || response.statusText;
                }
                
                // Handle rate limiting specifically - check status and message text
                const isRateLimit = response.status === 429 || 
                    errorMessage.toLowerCase().includes('too many requests') || 
                    errorMessage.toLowerCase().includes('rate limit') ||
                    errorText.toLowerCase().includes('too many requests') ||
                    errorText.toLowerCase().includes('rate limit');
                
                if (isRateLimit) {
                    this.logger.warn(`OpenRouter rate limit hit for vision API. Returning placeholder.`);
                    return 'Image analysis temporarily unavailable due to rate limiting. Please try again later.';
                }
                
                throw new Error(`OpenRouter API error: ${response.status} ${errorMessage}`);
            }

            const data = await response.json() as any;
            return data.choices[0].message.content;
        } catch (error: any) {
            // Check if error message contains rate limit indicators
            if (error.message && (
                error.message.toLowerCase().includes('too many requests') ||
                error.message.toLowerCase().includes('rate limit') ||
                error.message.toLowerCase().includes('429')
            )) {
                this.logger.warn(`OpenRouter rate limit detected in error. Returning placeholder.`);
                return 'Image analysis temporarily unavailable due to rate limiting. Please try again later.';
            }
            this.logger.error(`Failed to call OpenRouter for vision: ${error.message}`);
            throw error;
        }
    }

    /**
     * Fetch available models from OpenRouter API
     * @param apiKey Optional API key (uses instance key if not provided)
     * @returns List of processed models with tier classification
     */
    async getAvailableModels(apiKey?: string): Promise<ProcessedModel[]> {
        const keyToUse = apiKey || this.apiKey;
        const cacheKey = 'openrouter:models:list';
        
        // Check cache first
        const cached = await this.cache.get<ProcessedModel[]>(cacheKey);
        if (cached) {
            this.logger.debug('Returning cached models list');
            return cached;
        }

        try {
            this.logger.log('Fetching models list from OpenRouter API');
            
            const response = await fetch(this.modelsUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${keyToUse}`,
                    'HTTP-Referer': this.configService.get<string>('FRONTEND_URL') || '',
                    'X-Title': 'Aegis-Intel OSINT Platform',
                } as any,
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = response.statusText;
                
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.error?.message || errorData.message || response.statusText;
                } catch {
                    errorMessage = errorText || response.statusText;
                }
                
                this.logger.error(`OpenRouter models API error: ${response.status} ${errorMessage}`);
                throw new Error(`OpenRouter models API error: ${response.status} ${errorMessage}`);
            }

            const data = await response.json() as { data: OpenRouterModel[] };
            
            if (!Array.isArray(data.data)) {
                throw new Error('Invalid response structure from OpenRouter models API');
            }

            // Process models
            const processedModels: ProcessedModel[] = data.data.map((model) => {
                // Extract provider from model ID (e.g., "google/gemma-3-27b-it" -> "google")
                const provider = model.id.split('/')[0] || 'unknown';
                
                // Determine tier: free if id ends with :free OR pricing is 0
                const isFree = model.id.endsWith(':free') || 
                    (model.pricing && 
                     parseFloat(model.pricing.prompt) === 0 && 
                     parseFloat(model.pricing.completion) === 0);
                
                // Check if model supports vision
                const modality = model.architecture?.modality || '';
                const supportsVision = modality.includes('vision') || 
                    modality.includes('multimodal') ||
                    model.id.toLowerCase().includes('vision') ||
                    model.id.toLowerCase().includes('vl-') ||
                    model.name?.toLowerCase().includes('vision') || false;

                return {
                    id: model.id,
                    name: model.name || model.id,
                    provider: provider.charAt(0).toUpperCase() + provider.slice(1),
                    description: model.description || `${model.name || model.id} model`,
                    tier: isFree ? 'free' : 'paid',
                    contextLength: model.context_length,
                    modality: modality || 'text',
                    supportsVision,
                };
            });

            // Cache for 1 hour (3600 seconds)
            await this.cache.set(cacheKey, processedModels, 3600);
            
            this.logger.log(`Fetched ${processedModels.length} models from OpenRouter`);
            return processedModels;
        } catch (error: any) {
            this.logger.error(`Failed to fetch models from OpenRouter: ${error.message}`);
            
            // Try to return cached data even if expired
            const staleCache = await this.cache.get<ProcessedModel[]>(cacheKey);
            if (staleCache) {
                this.logger.warn('Returning stale cached models list due to API error');
                return staleCache;
            }
            
            // If no cache available, return empty array
            this.logger.warn('No cached models available, returning empty list');
            return [];
        }
    }
}
