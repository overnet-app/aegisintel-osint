import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLMProvider, LLMResponse, MCPMessage, MCPTool, MCPToolCall } from './types/mcp.types';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { LlamaCppProvider } from './providers/llamacpp.provider';

@Injectable()
export class McpClientService {
  private readonly logger = new Logger(McpClientService.name);
  private providers: Map<string, LLMProvider> = new Map();

  constructor(
    private configService: ConfigService,
    private openRouterProvider: OpenRouterProvider,
    private llamaCppProvider: LlamaCppProvider,
  ) {
    this.providers.set('openrouter', openRouterProvider);
    this.providers.set('llamacpp', llamaCppProvider);
  }

  async chat(
    messages: MCPMessage[],
    tools: MCPTool[],
    providerName: string = 'openrouter',
    toolExecutor?: (toolCall: MCPToolCall) => Promise<string>,
  ): Promise<LLMResponse> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`);
    }

    this.logger.log(`Using provider: ${providerName} with ${tools.length} tools`);

    // Call LLM
    const response = await provider.chat(messages, tools);

    // If there are tool calls and we have an executor, execute them
    if (response.toolCalls && response.toolCalls.length > 0 && toolExecutor) {
      this.logger.log(`Executing ${response.toolCalls.length} tool calls`);

      const toolResults: MCPMessage[] = [];
      for (const toolCall of response.toolCalls) {
        try {
          const result = await toolExecutor(toolCall);
          toolResults.push({
            role: 'tool',
            content: result,
            toolCallId: toolCall.name,
          });
        } catch (error) {
          this.logger.error(`Tool execution error: ${error.message}`);
          toolResults.push({
            role: 'tool',
            content: `Error: ${error.message}`,
            toolCallId: toolCall.name,
          });
        }
      }

      // Add tool results to messages and call LLM again
      const updatedMessages = [...messages, ...toolResults];
      return this.chat(updatedMessages, tools, providerName, toolExecutor);
    }

    return response;
  }

  getProvider(name: string): LLMProvider | undefined {
    return this.providers.get(name);
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
