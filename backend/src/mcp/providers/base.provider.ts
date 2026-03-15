import { LLMProvider, LLMResponse, MCPMessage, MCPTool } from '../types/mcp.types';

export abstract class BaseLLMProvider implements LLMProvider {
  abstract name: string;
  abstract supportsTools: boolean;

  abstract chat(messages: MCPMessage[], tools?: MCPTool[]): Promise<LLMResponse>;
}
