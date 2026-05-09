import { Module } from '@nestjs/common';
import { LlmAnalyzerService } from './llm-analyzer.service';

@Module({
  providers: [LlmAnalyzerService],
  exports: [LlmAnalyzerService],
})
export class LlmAnalyzerModule {}
