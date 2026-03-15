export interface Source {
  url: string;
  title: string;
  snippet?: string;
  reliability?: 'high' | 'medium' | 'low';
}

export interface ToolResult {
  content: string;
  sources: Source[];
  metadata?: Record<string, any>;
}

export interface ResearchTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute(args: any): Promise<ToolResult>;
}
