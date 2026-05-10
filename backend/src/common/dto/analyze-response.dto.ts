import { Verdict } from '../types/verdict.enum';
import { DetectedPattern } from '../types/detected-pattern';

/**
 * Response returned by POST /analyze to Claude Code PreToolUse hooks.
 *
 * Risk score thresholds:
 *   0–30   → ALLOW
 *   30–70  → WARN
 *   70–100 → BLOCK
 */
export class AnalyzeResponseDto {
  /** Security verdict determining whether the tool call should proceed. */
  verdict!: Verdict;

  /** Numeric risk score 0–100 (weighted combination of rule engine + LLM scores). */
  risk_score!: number;

  /** Human-readable explanation shown to the user on WARN or BLOCK verdicts. */
  reason!: string;

  /** Granular list of patterns detected during analysis. May be empty. */
  detected_patterns!: DetectedPattern[];
}
