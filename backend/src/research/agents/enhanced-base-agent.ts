import { Injectable, Logger, Optional } from '@nestjs/common';
import { OpenRouterService, ToolDefinition, ToolCall, ToolCallResult, StructuredOutputSchema } from '../../ai/open-router.service';
import { McpClientService } from '../../mcp/mcp-client.service';
import { MCPMessage } from '../../mcp/types/mcp.types';
import { AgentModelResolverService } from '../services/agent-model-resolver.service';

@Injectable()
export abstract class EnhancedBaseAgent {
  protected readonly logger: Logger;
  protected readonly agentName: string;

  constructor(
    protected openRouter: OpenRouterService,
    protected mcpClient: McpClientService,
    @Optional() protected agentModelResolver?: AgentModelResolverService,
  ) {
    this.logger = new Logger(this.constructor.name);
    // Extract agent name from class name to match frontend IDs
    // "ArchitectAgent" -> "architect", "RapidAnalystAgent" -> "rapidAnalyst"
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
   * Call LLM with native tool calling support
   * @param prompt User prompt
   * @param tools Array of tool definitions
   * @param provider Provider ('openrouter' or 'llamacpp')
   * @param model Model identifier
   * @param toolCallHandler Handler for executing tool calls
   * @param timeoutMs Timeout in milliseconds
   * @returns Final response or tool calls
   */
  protected async callWithTools(
    prompt: string,
    tools: ToolDefinition[],
    provider: string = 'openrouter',
    model: string = 'openai/gpt-4o',
    toolCallHandler?: (toolCalls: ToolCall[]) => Promise<ToolCallResult[]>,
    timeoutMs: number = 120000,
  ): Promise<string | { toolCalls: ToolCall[]; toolResults?: ToolCallResult[] }> {
    const llmCall = async () => {
      if (provider === 'llamacpp') {
        // llama.cpp doesn't support native tool calling yet
        // Fall back to regular call
        this.logger.warn('Tool calling not supported for llama.cpp, falling back to regular call');
        const messages: MCPMessage[] = [{ role: 'user', content: prompt }];
        const response = await this.mcpClient.chat(messages, [], 'llamacpp');
        return response.content;
      } else {
        return this.openRouter.completeWithTools(prompt, tools, model, toolCallHandler);
      }
    };

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Tool calling timed out after ${timeoutMs / 1000} seconds`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([llmCall(), timeoutPromise]);
    } catch (error: any) {
      this.logger.error(`Tool calling failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Call LLM with structured output using JSON schema
   * @param prompt User prompt
   * @param schema JSON schema for output structure
   * @param provider Provider ('openrouter' or 'llamacpp')
   * @param model Model identifier (defaults to Claude 3.5 Sonnet for reliable structured output)
   * @param timeoutMs Timeout in milliseconds
   * @returns Parsed structured output
   */
  protected async callWithSchema<T>(
    prompt: string,
    schema: StructuredOutputSchema,
    provider: string = 'openrouter',
    model: string = 'google/gemma-3-27b-it', // Default fallback only if no model provided
    timeoutMs: number = 90000,
  ): Promise<T> {
    const llmCall = async (): Promise<T> => {
      if (provider === 'llamacpp') {
        // llama.cpp doesn't support structured outputs
        // Fall back to regular call and parse
        this.logger.warn('Structured output not supported for llama.cpp, using regular call with parsing');
        const messages: MCPMessage[] = [{ role: 'user', content: prompt }];
        const response = await this.mcpClient.chat(messages, [], 'llamacpp');
        
        // Try to parse as JSON
        try {
          const parsed = JSON.parse(response.content);
          return parsed as T;
        } catch {
          // If parsing fails, try to extract JSON from response
          const jsonMatch = response.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]) as T;
          }
          throw new Error('Failed to parse structured output from llama.cpp');
        }
      } else {
        return this.openRouter.completeWithSchema<T>(prompt, schema, model);
      }
    };

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Structured output call timed out after ${timeoutMs / 1000} seconds`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([llmCall(), timeoutPromise]);
    } catch (error: any) {
      this.logger.error(`Structured output call failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Call LLM with chain-of-thought reasoning
   * @param prompt User prompt
   * @param provider Provider ('openrouter' or 'llamacpp')
   * @param model Model identifier (defaults to o1-preview for best reasoning)
   * @param timeoutMs Timeout in milliseconds
   * @returns Response with reasoning steps
   */
  protected async callWithReasoning(
    prompt: string,
    provider: string = 'openrouter',
    model: string = 'openai/o1-preview',
    timeoutMs: number = 180000, // Longer timeout for reasoning
  ): Promise<string> {
    const reasoningPrompt = `Think step by step to solve this problem. Show your reasoning process clearly.

${prompt}

Provide your answer with clear reasoning steps.`;

    const llmCall = async (): Promise<string> => {
      if (provider === 'llamacpp') {
        const messages: MCPMessage[] = [{ role: 'user', content: reasoningPrompt }];
        const response = await this.mcpClient.chat(messages, [], 'llamacpp');
        return response.content;
      } else {
        // Use o1 models for reasoning if available, otherwise use regular call
        if (model.includes('o1')) {
          // o1 models have built-in reasoning, just use regular call
          return this.openRouter.complete(reasoningPrompt, model, false);
        } else {
          // For other models, add CoT instructions
          return this.openRouter.complete(reasoningPrompt, model, false);
        }
      }
    };

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Reasoning call timed out after ${timeoutMs / 1000} seconds`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([llmCall(), timeoutPromise]);
    } catch (error: any) {
      this.logger.error(`Reasoning call failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use callWithSchema, callWithTools, or callWithReasoning instead
   */
  protected async callLLM(
    prompt: string,
    provider: string = 'openrouter',
    model: string = 'google/gemma-3-27b-it',
    timeoutMs: number = 90000,
  ): Promise<string> {
    const llmCall = async (): Promise<string> => {
      if (provider === 'llamacpp') {
        const messages: MCPMessage[] = [{ role: 'user', content: prompt }];
        const response = await this.mcpClient.chat(messages, [], 'llamacpp');
        return response.content;
      } else {
        const useFallback = model.includes(':free');
        return this.openRouter.complete(prompt, model, useFallback);
      }
    };

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`LLM call timed out after ${timeoutMs / 1000} seconds`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([llmCall(), timeoutPromise]);
    } catch (error: any) {
      this.logger.error(`LLM call failed: ${error.message}`);
      throw error;
    }
  }
}
