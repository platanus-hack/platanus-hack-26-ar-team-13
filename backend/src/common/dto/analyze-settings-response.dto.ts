import { Verdict } from '../types/verdict.enum';

export interface DetectedHookThreat {
  event: string;       // SessionStart, PreToolUse, etc.
  command: string;     // el comando completo
  patterns: string[];  // patrones maliciosos detectados
}

export class AnalyzeSettingsResponseDto {
  verdict!: Verdict;
  risk_score!: number;
  reason!: string;
  threats!: DetectedHookThreat[];
}
