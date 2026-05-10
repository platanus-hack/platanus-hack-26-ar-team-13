import { Injectable, Logger } from '@nestjs/common';
import { ToolCallRequestDto } from '../common/dto/tool-call-request.dto';
import { AnalyzeResponseDto } from '../common/dto/analyze-response.dto';
import { AnalyzeSettingsRequestDto } from '../common/dto/analyze-settings-request.dto';
import { AnalyzeSettingsResponseDto, DetectedHookThreat } from '../common/dto/analyze-settings-response.dto';
import { LlmAnalyzerService } from '../llm-analyzer/llm-analyzer.service';
import { Verdict } from '../common/types/verdict.enum';
import { DetectedPattern } from '../common/types/detected-pattern';

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

    const input = request.tool_input as any;
    const textsToCheck: string[] = [];

    if (request.tool_name === 'Bash') {
      if (input?.command) textsToCheck.push(input.command);
    } else if (request.tool_name === 'Write') {
      if (input?.file_path) textsToCheck.push(input.file_path);
      if (input?.content) textsToCheck.push(input.content);
    } else if (request.tool_name === 'Edit') {
      if (input?.file_path) textsToCheck.push(input.file_path);
      if (input?.new_string) textsToCheck.push(input.new_string);
    } else {
      textsToCheck.push(JSON.stringify(request.tool_input));
    }

    const seen = new Set<string>();
    const detectedPatterns: DetectedPattern[] = [];
    let ruleScore = 0;

    for (const text of textsToCheck) {
      for (const { pattern, label, score } of AnalyzerService.MALICIOUS_PATTERNS) {
        if (!seen.has(label) && pattern.test(text)) {
          seen.add(label);
          detectedPatterns.push({
            patternId: label.replace(/\s+/g, '_').toLowerCase(),
            name: label,
            riskLevel: score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW',
            confidence: 90,
            context: text.slice(0, 120),
          });
          ruleScore = Math.max(ruleScore, score);
        }
      }
    }

    if (detectedPatterns.length > 1) {
      ruleScore = Math.min(100, ruleScore + detectedPatterns.length * 5);
    }

    let finalScore = ruleScore;

    // Dual-path: zona ambigua → llamar LLM para análisis semántico
    if (ruleScore >= 30 && ruleScore < 70) {
      try {
        const llmResult = await this.llmAnalyzer.analyzeWithClaude(request);
        finalScore = Math.round(ruleScore * 0.7 + llmResult.riskScore * 0.3);
        this.logger.log(`LLM score: ${llmResult.riskScore}, combined: ${finalScore}`);
        for (const p of llmResult.detectedPatterns) {
          if (!seen.has(p.name)) {
            seen.add(p.name);
            detectedPatterns.push(p);
          }
        }
      } catch (err) {
        this.logger.warn(`LLM analysis failed, using rule score: ${(err as Error).message}`);
      }
    }

    let verdict: Verdict;
    if (finalScore >= 70) verdict = Verdict.BLOCK;
    else if (finalScore >= 30) verdict = Verdict.WARN;
    else verdict = Verdict.ALLOW;

    const reason = detectedPatterns.length === 0
      ? 'No suspicious patterns detected.'
      : `Detected: ${detectedPatterns.map(p => p.name).join(', ')}.`;

    this.logger.log(`Tool verdict: ${verdict} (score=${finalScore})`);
    return { verdict, risk_score: finalScore, reason, detected_patterns: detectedPatterns };
  }

  private static readonly MALICIOUS_PATTERNS: Array<{ pattern: RegExp; label: string; score: number }> = [
    // Fetch remote content and pipe directly into a shell interpreter
    { pattern: /(curl|wget)\s+.+\|\s*(bash|sh|zsh|ash|dash|python\d*|node|perl|ruby)/i, label: 'remote pipe to shell', score: 90 },

    // Decode base64 blob and execute — classic in-memory payload delivery
    { pattern: /base64\s+-d.+\|\s*(bash|sh|zsh|python\d*|node|perl|ruby)/i, label: 'base64 decode and execute', score: 85 },

    // Access known credential directories
    { pattern: /~\/\.(ssh|aws|gcp|kube|gnupg)\//i, label: 'credential directory access', score: 80 },

    // Access Unix system credential files
    { pattern: /\/etc\/(passwd|shadow|sudoers)/i, label: 'system credential file access', score: 85 },

    // Execute a hidden (dot-prefixed) file dropped in /tmp
    { pattern: /\/tmp\/\.[^\s]+\.(sh|py|rb|js|pl)/i, label: 'hidden temp file execution', score: 75 },

    // Write to cron or init systems to persist across reboots
    { pattern: /(crontab\s+-[eli]|\/etc\/cron\.|LaunchAgents|\.config\/systemd)/i, label: 'persistence mechanism', score: 80 },

    // Script deletes itself after running to hinder forensics
    { pattern: /rm\s+(-rf?\s+)?["']?\$0["']?|unlink\s+["']?\$0["']?/i, label: 'self-deleting script', score: 75 },
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
