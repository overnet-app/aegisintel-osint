import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseLLMProvider } from './base.provider';
import { LLMResponse, MCPMessage, MCPTool } from '../types/mcp.types';

@Injectable()
export class LlamaCppProvider extends BaseLLMProvider {
  private readonly logger = new Logger(LlamaCppProvider.name);
  readonly name = 'llamacpp';
  readonly supportsTools = false; // Most llama.cpp models don't support native tool calling
  private readonly endpoint: string;
  private readonly model: string;

  constructor(private configService: ConfigService) {
    super();
    this.endpoint = this.configService.get<string>('LLAMACPP_ENDPOINT') || 'http://localhost:8080';
    this.model = this.configService.get<string>('LLAMACPP_MODEL') || 'llama-3.2-3b';
  }

  async chat(messages: MCPMessage[], tools?: MCPTool[]): Promise<LLMResponse> {
    this.logger.log(`llama.cpp chat request to ${this.endpoint} with ${messages.length} messages`);

    // Convert to OpenAI-compatible format
    const openAIMessages = messages
      .filter((msg) => msg.role !== 'tool') // Skip tool messages
      .map((msg) => ({
        role: msg.role === 'system' ? 'system' : msg.role,
        content: msg.content,
      }));

    // If tools are provided but model doesn't support native tool calling,
    // inject tool descriptions into system message
    let systemMessage = openAIMessages.find((m) => m.role === 'system')?.content || '';
    if (tools && tools.length > 0 && !this.supportsTools) {
      const toolDescriptions = tools.map((t) => `- ${t.name}: ${t.description}`).join('\n');
      systemMessage += `\n\nAvailable tools:\n${toolDescriptions}\n\nWhen you need to use a tool, describe what tool to use and with what arguments in your response.`;
    }

    const body = {
      model: this.model,
      messages: openAIMessages.map((m) => 
        m.role === 'system' ? { ...m, content: systemMessage } : m
      ),
      temperature: 0.7,
      stream: false,
    };

    try {
      const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`llama.cpp API error: ${response.status} ${error}`);
      }

      const data = await response.json() as any;
      const choice = data.choices?.[0];

      if (!choice) {
        throw new Error('No response from llama.cpp');
      }

      return {
        content: choice.message.content || '',
        finishReason: choice.finish_reason || 'stop',
      };
    } catch (error) {
      this.logger.error(`llama.cpp chat error: ${error.message}`);
      throw error;
    }
  }
}
