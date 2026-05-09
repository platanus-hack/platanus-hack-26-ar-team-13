import { Injectable } from '@nestjs/common';
import { ToolCallRequestDto } from '../common/dto/tool-call-request.dto';
import { AnalyzeResponseDto } from '../common/dto/analyze-response.dto';
import { LlmAnalyzerService } from '../llm-analyzer/llm-analyzer.service';
import { Verdict } from '../common/types/verdict.enum';

/**
 * Orchestrates rule-based and LLM-based security analysis.
 *
 * Fast path:  rule engine only           (~10 ms, no API call)
 * Slow path:  rule engine + LLM          (~2–5 s, Anthropic API)
 *
 * Slow path is triggered when rule score is in the WARN range (30–70),
 * indicating the situation is ambiguous enough to warrant semantic analysis.
 *
 * Final score = (ruleScore * 0.7) + (llmScore * 0.3)
 *
 * Score → Verdict:
 *   0–30   → ALLOW
 *   30–70  → WARN
 *   70–100 → BLOCK
 */
@Injectable()
export class AnalyzerService {
  constructor(
    private readonly llmAnalyzer: LlmAnalyzerService,
  ) {}
}
