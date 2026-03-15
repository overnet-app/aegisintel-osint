import { Injectable, Logger, Optional } from '@nestjs/common';
import { OpenRouterService } from '../../ai/open-router.service';
import { McpClientService } from '../../mcp/mcp-client.service';
import { MCPMessage } from '../../mcp/types/mcp.types';
import { AgentModelResolverService } from '../services/agent-model-resolver.service';

@Injectable()
export abstract class BaseResearchAgent {
  protected readonly logger: Logger;
  protected readonly agentName: string;

  constructor(
    protected openRouter: OpenRouterService,
    protected mcpClient: McpClientService,
    @Optional() protected agentModelResolver?: AgentModelResolverService,
  ) {
    this.logger = new Logger(this.constructor.name);
    // Extract agent name from class name to match frontend IDs
    // "ScoutAgent" -> "scout", "RapidAnalystAgent" -> "rapidAnalyst"
    const className = this.constructor.name.replace(/Agent$/, '');
    // Convert PascalCase to camelCase, but keep first letter lowercase
    this.agentName = className.charAt(0).toLowerCase() + className.slice(1);
  }

  /**
   * Resolve model configuration for this agent
   * @param userId User ID (optional - if not provided, uses defaults)
   * @param defaultProvider Default provider fallback
   * @param defaultModel Default model fallback (optional - will use user's configured defaultModel if not provided)
   * @returns Resolved provider and model
   */
  protected async resolveModel(
    userId?: string,
    defaultProvider: string = 'openrouter',
    defaultModel?: string, // Optional - will use user's defaultModel from config
  ): Promise<{ provider: string; model: string }> {
    if (userId && this.agentModelResolver) {
      try {
        return await this.agentModelResolver.resolveAgentModel(
          userId,
          this.agentName,
          defaultProvider,
          defaultModel, // Pass undefined to let resolver use user's defaultModel
        );
      } catch (error: any) {
        this.logger.warn(`Failed to resolve model for ${this.agentName}, using defaults: ${error.message}`);
        // Fallback to system default if resolution fails
        return { provider: defaultProvider, model: defaultModel || 'google/gemma-3-27b-it' };
      }
    }
    // If no userId, use provided default or system default
    return { provider: defaultProvider, model: defaultModel || 'google/gemma-3-27b-it' };
  }

  /**
   * Call LLM with the specified provider and model
   * Includes timeout protection (90 seconds for complex operations)
   */
  protected async callLLM(
    prompt: string,
    provider: string,
    model: string,
    timeoutMs: number = 90000,
  ): Promise<string> {
    const llmCall = async (): Promise<string> => {
      if (provider === 'llamacpp') {
        // Use MCP client for llama.cpp
        const messages: MCPMessage[] = [
          { role: 'user', content: prompt },
        ];
        
        try {
          const response = await this.mcpClient.chat(messages, [], 'llamacpp');
          return response.content;
        } catch (error: any) {
          this.logger.error(`llama.cpp call failed: ${error.message}`);
          throw error;
        }
      } else {
        // Use OpenRouter (default)
        // For research, use the specified model without fallback to respect user's choice
        // Only use fallback for free models (they have :free suffix)
        const useFallback = model.includes(':free');
        return this.openRouter.complete(prompt, model as any, useFallback);
      }
    };

    // Add timeout wrapper
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`LLM call timed out after ${timeoutMs / 1000} seconds`));
      }, timeoutMs);
    });

    try {
      
      const result = await Promise.race([llmCall(), timeoutPromise]);
      
      
      return result;
    } catch (error: any) {
      
      this.logger.error(`LLM call failed or timed out: ${error.message}`);
      throw error;
    }
  }
}
