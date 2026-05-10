import { Module } from '@nestjs/common';
import { LlmAnalyzerModule } from '../llm-analyzer/llm-analyzer.module';
import { PromptGuardModule } from '../prompt-guard/prompt-guard.module';
import { AuditModule } from '../audit/audit.module';
import { AnalyzerController } from './analyzer.controller';
import { AnalyzerService } from './analyzer.service';

@Module({
  imports: [LlmAnalyzerModule, PromptGuardModule, AuditModule],
  controllers: [AnalyzerController],
  providers: [AnalyzerService],
  exports: [AnalyzerService],
})
export class AnalyzerModule {}
