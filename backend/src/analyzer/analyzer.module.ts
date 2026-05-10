import { Module } from '@nestjs/common';
import { LlmAnalyzerModule } from '../llm-analyzer/llm-analyzer.module';
import { PromptGuardModule } from '../prompt-guard/prompt-guard.module';
import { AnalyzerController } from './analyzer.controller';
import { AnalyzerService } from './analyzer.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [LlmAnalyzerModule, PromptGuardModule, AuthModule],
  controllers: [AnalyzerController],
  providers: [AnalyzerService],
  exports: [AnalyzerService],
})
export class AnalyzerModule {}
