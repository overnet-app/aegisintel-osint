import { Module } from '@nestjs/common';
import { McpServerService } from './mcp-server.service';
import { McpClientService } from './mcp-client.service';
import { McpController } from './mcp.controller';
import { OpenRouterProvider } from './providers/openrouter.provider';
import { LlamaCppProvider } from './providers/llamacpp.provider';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  providers: [
    McpServerService,
    McpClientService,
    OpenRouterProvider,
    LlamaCppProvider,
  ],
  controllers: [McpController],
  exports: [McpServerService, McpClientService],
})
export class McpModule {}
