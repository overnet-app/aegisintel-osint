import { Injectable, Logger } from '@nestjs/common';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MCPTool, MCPToolCall, MCPToolResult } from './types/mcp.types';

@Injectable()
export class McpServerService {
  private readonly logger = new Logger(McpServerService.name);
  private server: Server;
  private tools: Map<string, (args: any) => Promise<MCPToolResult>> = new Map();

  constructor() {
    this.server = new Server(
      {
        name: 'aegis-research-tools',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const toolList = Array.from(this.tools.keys()).map((name) => {
        // Get tool definition from registry
        return {
          name,
          description: `Tool: ${name}`,
          inputSchema: {
            type: 'object' as const,
            properties: {},
          },
        };
      });

      return { tools: toolList };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (!this.tools.has(name)) {
        throw new Error(`Tool ${name} not found`);
      }

      try {
        const tool = this.tools.get(name)!;
        const result = await tool(args);
        return {
          content: [
            {
              type: 'text' as const,
              text: result.content,
            },
          ],
          isError: result.isError || false,
        };
      } catch (error) {
        this.logger.error(`Tool execution error for ${name}: ${error.message}`);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  registerTool(name: string, handler: (args: any) => Promise<MCPToolResult>) {
    this.tools.set(name, handler);
    this.logger.log(`Registered MCP tool: ${name}`);
  }

  async start() {
    // For SSE transport, we'll handle this in the controller
    this.logger.log('MCP Server initialized');
  }

  getToolList(): MCPTool[] {
    return Array.from(this.tools.keys()).map((name) => ({
      name,
      description: `Tool: ${name}`,
      inputSchema: {
        type: 'object',
        properties: {},
      },
    }));
  }
}
