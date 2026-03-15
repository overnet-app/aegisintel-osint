import { Controller, Put, Body, UseGuards, Req, Get, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { UserService } from './user.service';
import { AuthGuard } from '@nestjs/passport';
import { OpenRouterService } from '../ai/open-router.service';
import * as fs from 'fs';
import * as path from 'path';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UserController {
    private readonly logger = new Logger(UserController.name);
    private readonly debugLogPath = path.join(process.cwd(), '.cursor', 'debug.log');

    constructor(
        private userService: UserService,
        private openRouterService: OpenRouterService,
    ) { }

    private writeDebugLog(location: string, message: string, data: any, hypothesisId: string) {
        try {
            const logEntry = {
                location,
                message,
                data,
                timestamp: Date.now(),
                sessionId: 'debug-session',
                runId: 'run1',
                hypothesisId,
            };
            const logDir = path.dirname(this.debugLogPath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            fs.appendFileSync(this.debugLogPath, JSON.stringify(logEntry) + '\n');
        } catch (e) {
            // Silent fail for debug logging
        }
    }

    @Put('settings/model')
    async updateModel(@Req() req: any, @Body('model') model: string) {
        return this.userService.updatePreferredModel(req.user.id, model);
    }

    @Put('settings/credentials')
    async updateCredentials(@Req() req: any, @Body('keys') keys: any) {
        return this.userService.updateThirdPartyKeys(req.user.id, keys);
    }

    @Put('settings/services')
    async updateServices(@Req() req: any, @Body('services') services: any) {
        return this.userService.updateEnabledServices(req.user.id, services);
    }

    @Put('settings/research-model')
    async updateResearchModel(
        @Req() req: any,
        @Body() body: { provider: string; tier: string; model: string },
    ) {
        return this.userService.updateResearchModelSettings(
            req.user.id,
            body.provider,
            body.tier,
            body.model,
        );
    }

    @Get('me')
    async getProfile(@Req() req: any) {
        try {
            const user = await this.userService.findById(req.user?.id);
            if (!user) {
                throw new HttpException('User not found', HttpStatus.NOT_FOUND);
            }
            // Exclude password from response - use explicit field selection to avoid serialization issues
            const userWithoutPassword: any = {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                isActive: user.isActive,
                preferredModel: user.preferredModel,
                defaultModel: user.defaultModel,
                researchModelProvider: user.researchModelProvider,
                researchModelTier: user.researchModelTier,
                researchModel: user.researchModel,
                thirdPartyKeys: user.thirdPartyKeys,
                enabledServices: user.enabledServices,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            };
            return userWithoutPassword;
        } catch (error: any) {
            this.logger.error(`Failed to get user profile: ${error.message}`, error.stack);
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                `Failed to get user profile: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get('settings/agent-models')
    async getAgentModelConfigs(@Req() req: any) {
        const user = await this.userService.findById(req.user.id);
        if (!user) {
            throw new HttpException('User not found', HttpStatus.NOT_FOUND);
        }
        
        const agentConfigs = user.agentModelConfig as any || {};
        return { agentModelConfig: agentConfigs };
    }

    @Put('settings/agent-models')
    async updateAgentModelConfig(
        @Req() req: any,
        @Body() body: { agentName: string; config: { provider: string; tier?: string; model: string } },
    ) {
        return this.userService.updateAgentModelConfig(
            req.user.id,
            body.agentName,
            body.config,
        );
    }

    @Put('settings/default-model')
    async updateDefaultModel(@Req() req: any, @Body('model') model: string) {
        return this.userService.updateDefaultModel(req.user.id, model);
    }
}

@Controller('models')
export class ModelsController {
    private readonly logger = new Logger(ModelsController.name);

    constructor(
        private openRouterService: OpenRouterService,
        private userService: UserService,
    ) { }

    @Get('openrouter')
    @UseGuards(AuthGuard('jwt'))
    async getOpenRouterModels(@Req() req: any) {
        try {
            // Try to get user's OpenRouter API key first
            const user = await this.userService.findById(req.user.id);
            let userApiKey: string | undefined;
            
            if (user?.thirdPartyKeys && typeof user.thirdPartyKeys === 'object') {
                const keys = user.thirdPartyKeys as any;
                userApiKey = keys.openRouter || keys.openrouter;
            }

            // Use user's API key if available, otherwise service will use system key
            const models = await this.openRouterService.getAvailableModels(userApiKey);
            
            return {
                models,
                count: models.length,
                source: userApiKey ? 'user-api-key' : 'system-api-key',
            };
        } catch (error: any) {
            this.logger.error(`Failed to fetch OpenRouter models: ${error.message}`);
            throw new HttpException(
                `Failed to fetch models: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
