import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { ToolCallRequestDto } from '../common/dto/tool-call-request.dto';
import { DetectedPattern } from '../common/types/detected-pattern';
/** Fill in the actual security analysis prompt when implementing this service. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SECURITY_ANALYSIS_SYSTEM_PROMPT = '';

export interface LlmAnalysisResult {
  /** Risk score 0–100 assigned by the LLM. */
  riskScore: number;
  /** Natural-language explanation of the risk assessment. */
  reasoning: string;
  detectedPatterns: DetectedPattern[];
}

/**
 * Semantic security analysis using Claude.
 *
 * Called only when the rule engine verdict is ambiguous (score 30–70) or
 * when the tool name suggests novel/complex behaviour.
 *
 * Trade-offs vs rule engine:
 * - Slower  (~2–5 s API latency)
 * - Costlier (API tokens)
 * - Non-deterministic across model versions
 * + Understands intent and context
 * + Catches novel attack patterns
 */
@Injectable()
export class LlmAnalyzerService {
  private readonly anthropic: Anthropic;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY') ?? '';
    this.model =
      this.configService.get<string>('LLM_MODEL') ?? 'claude-sonnet-4-6';

    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Send the tool call to Claude and return a structured risk assessment.
   *
   * Expected Claude response (JSON):
   * {
   *   "risk_score": number,       // 0–100
   *   "reasoning": string,
   *   "patterns": [
   *     { "id": string, "name": string, "risk_level": string,
   *       "confidence": number, "context"?: string }
   *   ]
   * }
   *
   * Implementation notes:
   * - Use non-streaming messages.create()
   * - Parse text content block as JSON
   * - Validate risk_score is 0–100 before returning
   *
   * @throws Error if Anthropic API fails or response JSON is invalid
   */
  async analyzeWithClaude(request: ToolCallRequestDto): Promise<LlmAnalysisResult> {
    throw new Error('Not implemented');
  }

  /**
   * Build the user message that Claude receives for analysis.
   *
   * Format:
   *   Tool: <tool_name>
   *   Session: <session_id>
   *   Working directory: <cwd>
   *   Input:
   *   <JSON-stringified tool_input>
   *
   *   Respond with a JSON object containing risk_score, reasoning, and patterns.
   */
  private formatAnalysisPrompt(request: ToolCallRequestDto): string {
    throw new Error('Not implemented');
  }

  /**
   * Parse the raw text content from Claude's response into LlmAnalysisResult.
   *
   * Validation:
   * - risk_score must be a number in [0, 100]
   * - patterns must be an array
   * - Each pattern confidence must be in [0, 100]
   *
   * @throws Error if JSON is malformed or required fields are missing/invalid
   */
  private parseLlmResponse(responseText: string): LlmAnalysisResult {
    throw new Error('Not implemented');
  }
}
