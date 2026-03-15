import { Controller, Get, Post, Body, Sse, MessageEvent } from '@nestjs/common';
import { McpServerService } from './mcp-server.service';
import { Observable } from 'rxjs';

@Controller('mcp')
export class McpController {
  constructor(private mcpServer: McpServerService) {}

  @Get('tools')
  async getTools() {
    return {
      tools: this.mcpServer.getToolList(),
    };
  }

  @Post('message')
  async handleMessage(@Body() body: any) {
    // Handle MCP messages from external clients
    // This would integrate with the MCP server
    return { status: 'ok' };
  }

  @Sse('sse')
  sse(): Observable<MessageEvent> {
    // SSE endpoint for MCP server transport
    return new Observable((observer) => {
      // Implementation would connect to MCP server
      observer.next({ data: { type: 'connected' } });
    });
  }
}
