export interface DetectedPattern {
  /** Unique identifier for the pattern (e.g., 'recursive_rm', 'pipe_to_shell'). */
  patternId: string;

  /** Human-readable name shown to the user. */
  name: string;

  /** Risk level of this specific pattern (RiskLevel enum value). */
  riskLevel: string;

  /** Confidence score 0–100 that the pattern is actually present. */
  confidence: number;

  /** Optional snippet from tool input that triggered detection. */
  context?: string;
}
