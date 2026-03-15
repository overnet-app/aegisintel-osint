import { Module, forwardRef } from '@nestjs/common';
import { ChainOfThoughtService } from './chain-of-thought';
import { ReActPatternService } from './react-pattern';
import { AiModule } from '../ai.module';

@Module({
    imports: [forwardRef(() => AiModule)],
    providers: [ChainOfThoughtService, ReActPatternService],
    exports: [ChainOfThoughtService, ReActPatternService],
})
export class ReasoningModule { }
