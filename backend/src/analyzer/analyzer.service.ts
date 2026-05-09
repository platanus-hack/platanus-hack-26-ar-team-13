import { Injectable, Logger } from '@nestjs/common';
import { ToolCallRequestDto } from '../common/dto/tool-call-request.dto';
import { AnalyzeResponseDto } from '../common/dto/analyze-response.dto';
import { AnalyzeSettingsRequestDto } from '../common/dto/analyze-settings-request.dto';
import { AnalyzeSettingsResponseDto, DetectedHookThreat } from '../common/dto/analyze-settings-response.dto';
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
  private readonly logger = new Logger(AnalyzerService.name);

  constructor(
    private readonly llmAnalyzer: LlmAnalyzerService,
  ) {}

  async analyze(request: ToolCallRequestDto): Promise<AnalyzeResponseDto> {
    this.logger.log(`Analyzing tool: ${request.tool_name}`);
    return {
      verdict: Verdict.ALLOW,
      risk_score: 0,
      reason: 'Stub - analysis not implemented yet',
      detected_patterns: [],
    };
  }

  // Patrones que indican ejecución remota de código o exfiltración
  private static readonly MALICIOUS_PATTERNS: Array<{ pattern: RegExp; label: string; score: number }> = [
    { pattern: /curl\s+.*\|\s*(bash|sh|zsh|python\d*|node|perl|ruby)/i,   label: 'curl pipe to shell',          score: 90 },
    { pattern: /wget\s+.*\|\s*(bash|sh|zsh|python\d*|node|perl|ruby)/i,   label: 'wget pipe to shell',          score: 90 },
    { pattern: /curl\s+-sL?\s+https?:\/\//i,                               label: 'silent curl to remote URL',   score: 40 },
    { pattern: /base64\s+-d.*\|\s*(bash|sh|zsh|python\d*)/i,               label: 'base64 decode and execute',   score: 85 },
    { pattern: /eval\s*\(/i,                                                label: 'eval execution',              score: 70 },
    { pattern: /nohup\s+.*&/i,                                             label: 'background persistent process',score: 60 },
    { pattern: /\/dev\/null\s*2>&1/i,                                      label: 'hidden output',               score: 30 },
    { pattern: /\/tmp\/\.[a-z0-9]+\.(py|sh|rb|js)/i,                      label: 'hidden temp file execution',  score: 75 },
    { pattern: /(rm\s+-f\s+\/tmp|unlink\s+\/tmp)/i,                       label: 'self-deleting payload',       score: 70 },
    { pattern: /~\/\.ssh\//i,                                              label: 'SSH key access',              score: 80 },
    { pattern: /~\/\.aws\//i,                                              label: 'AWS credentials access',      score: 80 },
    { pattern: /osascript\s+-e/i,                                          label: 'osascript execution (macOS)', score: 65 },
    { pattern: /security\s+(unlock-keychain|dump-keychain)/i,              label: 'macOS keychain access',       score: 95 },
    { pattern: /trycloudflare\.com|ngrok\.io|serveo\.net/i,                label: 'known tunneling service URL', score: 70 },
    { pattern: /xargs\s+curl|xargs\s+wget/i,                              label: 'chained network request',     score: 55 },
  ];

  analyzeSettings(request: AnalyzeSettingsRequestDto): AnalyzeSettingsResponseDto {
    this.logger.log(`Analyzing .claude/settings.json from: ${request.cwd}`);

    const threats: DetectedHookThreat[] = [];
    let maxScore = 0;

    const hooks = (request.settings as any)?.hooks ?? {};

    for (const [eventName, eventHooks] of Object.entries(hooks)) {
      const hookList = Array.isArray(eventHooks) ? eventHooks : [];
      for (const hookGroup of hookList) {
        const innerHooks = Array.isArray((hookGroup as any)?.hooks) ? (hookGroup as any).hooks : [];
        for (const hook of innerHooks) {
          const command: string = hook?.command ?? '';
          if (!command) continue;

          const matchedPatterns: string[] = [];
          let commandScore = 0;

          for (const { pattern, label, score } of AnalyzerService.MALICIOUS_PATTERNS) {
            if (pattern.test(command)) {
              matchedPatterns.push(label);
              commandScore = Math.max(commandScore, score);
            }
          }

          // Score compuesto: más patrones = más sospechoso
          if (matchedPatterns.length > 1) {
            commandScore = Math.min(100, commandScore + matchedPatterns.length * 5);
          }

          if (matchedPatterns.length > 0) {
            threats.push({ event: eventName, command, patterns: matchedPatterns });
            maxScore = Math.max(maxScore, commandScore);
          }
        }
      }
    }

    let verdict: Verdict;
    if (maxScore >= 70) verdict = Verdict.BLOCK;
    else if (maxScore >= 30) verdict = Verdict.WARN;
    else verdict = Verdict.ALLOW;

    const reason = threats.length === 0
      ? 'No suspicious hooks detected.'
      : `Found ${threats.length} suspicious hook(s). Patterns: ${[...new Set(threats.flatMap(t => t.patterns))].join(', ')}.`;

    this.logger.log(`Settings verdict: ${verdict} (score=${maxScore}), threats=${threats.length}`);

    return { verdict, risk_score: maxScore, reason, threats };
  }
}
