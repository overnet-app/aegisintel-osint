import { Injectable, Logger } from '@nestjs/common';
import { evaluate } from 'mathjs';
import { ResearchTool, ToolResult } from './base.tool';

@Injectable()
export class CalculatorTool implements ResearchTool {
  readonly name = 'calculator';
  readonly description = 'Perform mathematical calculations, unit conversions, and financial calculations. Supports expressions, percentages, and compound interest.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate (e.g., "2 + 2", "100 * 1.05^10", "100 USD to EUR")',
      },
    },
    required: ['expression'],
  };

  private readonly logger = new Logger(CalculatorTool.name);

  async execute(args: { expression?: string }): Promise<ToolResult> {
    if (!args || !args.expression) {
      this.logger.error('Calculator tool: expression parameter is missing');
      return {
        content: 'Error: Expression parameter is required. Please provide a valid mathematical expression with actual numbers (e.g., "2 + 2", "100 * 1.05^10").',
        sources: [],
      };
    }

    this.logger.log(`Calculator tool: ${args.expression}`);

    try {
      // Check for placeholder/variable names (common LLM mistake)
      // Match any word with underscores, or common placeholder patterns
      // Valid math functions: sin, cos, tan, sqrt, log, exp, abs, ceil, floor, round, pow, etc.
      const validMathFunctions = /^(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|sqrt|log|log10|log2|exp|abs|ceil|floor|round|pow|min|max|pi|e)$/i;
      
      // Find all word tokens in the expression
      const wordTokens = args.expression.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
      const invalidTokens = wordTokens.filter(token => !validMathFunctions.test(token));
      
      if (invalidTokens.length > 0) {
        return {
          content: `Cannot calculate: Expression "${args.expression}" contains variable names (${invalidTokens.join(', ')}). The calculator only works with actual numbers. Please substitute the numeric values. For example, instead of "(CurrentPrice - OldPrice) / OldPrice * 100", use "(150.50 - 45.20) / 45.20 * 100".`,
          sources: [],
          metadata: {
            error: 'placeholder_detected',
            expression: args.expression,
            invalidTokens,
          },
        };
      }

      // Sanitize expression to prevent code injection
      // Allow: digits, operators, parentheses, decimal points, spaces, and common math function names
      const allowedPattern = /^[0-9+\-*/().,^%\s\w]+$/;
      
      if (!allowedPattern.test(args.expression)) {
        throw new Error('Expression contains invalid characters');
      }

      // Block dangerous patterns (function calls that aren't math functions)
      const dangerousPatterns = /\b(import|require|eval|exec|spawn|process|fs|child_process|http|https|net|module)\b/i;
      if (dangerousPatterns.test(args.expression)) {
        throw new Error('Expression contains disallowed functions');
      }

      const result = evaluate(args.expression);

      return {
        content: `${args.expression} = ${result}`,
        sources: [],
        metadata: {
          expression: args.expression,
          result,
        },
      };
    } catch (error) {
      this.logger.error(`Calculator tool error: ${error.message}`);
      
      // Provide more helpful error for undefined symbols
      if (error.message.includes('Undefined symbol')) {
        return {
          content: `Error: ${error.message}. The calculator only works with actual numbers, not variable names. Please substitute the actual numeric values into your expression.`,
          sources: [],
        };
      }
      
      return {
        content: `Error: ${error.message}. Please provide a valid mathematical expression with actual numbers like "2 + 2", "sqrt(16)", "100 * 1.05^10", or "log(100)".`,
        sources: [],
      };
    }
  }
}
