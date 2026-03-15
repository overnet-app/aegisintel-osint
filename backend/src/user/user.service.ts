import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';

@Injectable()
export class UserService {
    constructor(private prisma: PrismaService) { }

    async findOne(email: string): Promise<User | null> {
        return this.prisma.user.findUnique({ where: { email } });
    }

    async findById(id: string): Promise<User | null> {
        return this.prisma.user.findUnique({ where: { id } });
    }

    async create(data: Prisma.UserCreateInput): Promise<User> {
        return this.prisma.user.create({ data });
    }

    async deleteUser(id: string): Promise<User> {
        return this.prisma.user.delete({ where: { id } });
    }

    async updatePreferredModel(id: string, model: string): Promise<User> {
        return this.prisma.user.update({
            where: { id },
            data: { preferredModel: model },
        });
    }

    async updateThirdPartyKeys(id: string, keys: any): Promise<User> {
        return this.prisma.user.update({
            where: { id },
            data: { thirdPartyKeys: keys },
        });
    }

    async updateEnabledServices(id: string, services: any): Promise<User> {
        return this.prisma.user.update({
            where: { id },
            data: { enabledServices: services } as any,
        });
    }

    async updateResearchModelSettings(
        id: string,
        provider: string,
        tier: string,
        model: string,
    ): Promise<User> {
        return this.prisma.user.update({
            where: { id },
            data: {
                researchModelProvider: provider,
                researchModelTier: tier,
                researchModel: model,
            },
        });
    }

    async updateAgentModelConfig(
        userId: string,
        agentName: string,
        config: { provider: string; tier?: string; model: string },
    ): Promise<User> {
        const user = await this.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const currentConfig = (user.agentModelConfig as any) || {};
        const updatedConfig = {
            ...currentConfig,
            [agentName]: config,
        };

        return this.prisma.user.update({
            where: { id: userId },
            data: { agentModelConfig: updatedConfig },
        });
    }

    async getAgentModelConfig(userId: string, agentName: string): Promise<any | null> {
        const user = await this.findById(userId);
        if (!user) {
            return null;
        }

        const config = (user.agentModelConfig as any) || {};
        return config[agentName] || null;
    }

    async getAllAgentModelConfigs(userId: string): Promise<Record<string, any>> {
        const user = await this.findById(userId);
        if (!user) {
            return {};
        }

        return (user.agentModelConfig as any) || {};
    }

    async getDefaultModel(userId: string): Promise<string> {
        const user = await this.findById(userId);
        if (!user) {
            return 'google/gemma-3-27b-it'; // System default
        }
        return user.defaultModel || 'google/gemma-3-27b-it'; // User's default or system default
    }

    async updateDefaultModel(userId: string, model: string): Promise<User> {
        return this.prisma.user.update({
            where: { id: userId },
            data: { defaultModel: model },
        });
    }
}
