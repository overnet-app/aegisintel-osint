export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPToolResult {
  content: string;
  isError?: boolean;
}

export interface MCPMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: MCPToolCall[];
  toolCallId?: string;
}

export interface MCPServerTransport {
  send(message: any): Promise<void>;
  close(): Promise<void>;
}

export interface LLMProvider {
  name: string;
  chat(messages: MCPMessage[], tools?: MCPTool[]): Promise<LLMResponse>;
  supportsTools: boolean;
}

export interface LLMResponse {
  content: string;
  toolCalls?: MCPToolCall[];
  finishReason?: 'stop' | 'tool_calls' | 'length';
}
