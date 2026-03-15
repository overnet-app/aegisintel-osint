import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { GdprController } from './gdpr.controller';
import { UserController, ModelsController } from './user.controller';
import { AiModule } from '../ai/ai.module';

@Module({
    imports: [AiModule],
    controllers: [GdprController, UserController, ModelsController],
    providers: [UserService],
    exports: [UserService],
})
export class UserModule { }
