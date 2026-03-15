import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../../user/user.service';

export interface AgentModelConfig {
    provider: string;
    tier?: string;
    model: string;
}

@Injectable()
export class AgentModelResolverService {
    private readonly logger = new Logger(AgentModelResolverService.name);

    constructor(private userService: UserService) {}

    /**
     * Resolve model configuration for a specific agent
     * @param userId User ID
     * @param agentName Agent name (e.g., 'architect', 'quant', 'logician')
     * @param defaultProvider Default provider to use if agent config not set
     * @param defaultModel Default model to use if agent config not set (will use user's defaultModel if not provided)
     * @returns Resolved provider and model
     */
    async resolveAgentModel(
        userId: string,
        agentName: string,
        defaultProvider: string,
        defaultModel?: string,
    ): Promise<{ provider: string; model: string }> {
        try {
            // Get user's default model if no defaultModel provided
            const userDefaultModel = defaultModel || await this.userService.getDefaultModel(userId);
            
            const agentConfig = await this.userService.getAgentModelConfig(userId, agentName);
            
            if (!agentConfig) {
                // No agent-specific config, use defaults
                this.logger.debug(
                    `No config for agent ${agentName}, using default: ${defaultProvider}:${userDefaultModel}`
                );
                return {
                    provider: defaultProvider,
                    model: userDefaultModel,
                };
            }

            const config = agentConfig as AgentModelConfig;
            let provider = config.provider || defaultProvider;
            let model = config.model || userDefaultModel;

            // Handle llamacpp provider
            if (provider === 'llamacpp') {
                model = 'local';
            }

            this.logger.debug(
                `Resolved model for agent ${agentName}: ${provider}:${model}`
            );

            return { provider, model };
        } catch (error: any) {
            this.logger.warn(
                `Failed to resolve model for agent ${agentName}, using default: ${error.message}`
            );
            // Get user's default model if no defaultModel provided
            const userDefaultModel = defaultModel || await this.userService.getDefaultModel(userId);
            return {
                provider: defaultProvider,
                model: userDefaultModel,
            };
        }
    }

    /**
     * Get all agent model configurations for a user
     * @param userId User ID
     * @returns Map of agent names to their model configurations
     */
    async getAllAgentConfigs(userId: string): Promise<Record<string, AgentModelConfig>> {
        try {
            return await this.userService.getAllAgentModelConfigs(userId);
        } catch (error: any) {
            this.logger.warn(`Failed to get agent configs: ${error.message}`);
            return {};
        }
    }
}
