import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseLLMProvider } from './base.provider';
import { LLMResponse, MCPMessage, MCPTool } from '../types/mcp.types';

@Injectable()
export class OpenRouterProvider extends BaseLLMProvider {
  private readonly logger = new Logger(OpenRouterProvider.name);
  readonly name = 'openrouter';
  readonly supportsTools = true;
  private readonly apiKey: string;
  private readonly apiUrl = 'https://openrouter.ai/api/v1/chat/completions';

  constructor(private configService: ConfigService) {
    super();
    this.apiKey = this.configService.get<string>('OPENROUTER_API_KEY')!;
  }

  async chat(messages: MCPMessage[], tools?: MCPTool[]): Promise<LLMResponse> {
    this.logger.log(`OpenRouter chat request with ${messages.length} messages, ${tools?.length || 0} tools`);

    // Convert MCP messages to OpenRouter format
    const openRouterMessages = messages.map((msg) => {
      if (msg.role === 'tool') {
        // OpenRouter doesn't support tool role directly, skip for now
        return null;
      }
      return {
        role: msg.role === 'system' ? 'system' : msg.role,
        content: msg.content,
      };
    }).filter(Boolean);

    // Convert tools to function calling format
    const functions = tools?.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    }));

    const body: any = {
      model: 'google/gemma-3-27b-it', // Default model, can be overridden
      messages: openRouterMessages,
    };

    if (functions && functions.length > 0) {
      body.tools = functions.map((fn) => ({
        type: 'function',
        function: fn,
      }));
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': this.configService.get<string>('FRONTEND_URL') || '',
          'X-Title': 'Aegis-Intel Research',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`OpenRouter API error: ${response.status} ${JSON.stringify(error)}`);
      }

      const data = await response.json() as any;
      const choice = data.choices?.[0];

      if (!choice) {
        throw new Error('No response from OpenRouter');
      }

      // Handle tool calls
      if (choice.message?.tool_calls) {
        return {
          content: choice.message.content || '',
          toolCalls: choice.message.tool_calls.map((tc: any) => ({
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments || '{}'),
          })),
          finishReason: choice.finish_reason,
        };
      }

      return {
        content: choice.message.content || '',
        finishReason: choice.finish_reason,
      };
    } catch (error) {
      this.logger.error(`OpenRouter chat error: ${error.message}`);
      throw error;
    }
  }
}
