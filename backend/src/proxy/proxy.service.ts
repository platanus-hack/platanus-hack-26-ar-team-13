import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AnalyzerService } from '../analyzer/analyzer.service';
import { AnalyzeResponseDto } from '../common/dto/analyze-response.dto';
import { Verdict } from '../common/types/verdict.enum';
import { DetectedPattern } from '../common/types/detected-pattern';
/**
 * Handles Anthropic API forwarding and tool_use interception.
 *
 * Non-streaming approach:
 *   1. Forward request body verbatim to Anthropic (non-streaming)
 *   2. Receive complete Message response
 *   3. Walk content blocks looking for type === 'tool_use'
 *   4. Analyze each tool_use with AnalyzerService
 *   5. ALLOW → keep unchanged
 *      WARN  → prepend a text warning block
 *      BLOCK → replace tool_use with a text explanation block
 *   6. Return modified response to client
 *
 * Two Anthropic SDK instances exist in the app:
 * - This service: uses ANTHROPIC_BASE_URL (the real upstream, to avoid proxying ourselves)
 * - LlmAnalyzerService: always calls api.anthropic.com
 */
@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);
  private readonly apiKey: string;
  private readonly upstreamBaseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly analyzerService: AnalyzerService,
  ) {
    this.apiKey = this.configService.get<string>('ANTHROPIC_API_KEY') ?? '';
    this.upstreamBaseUrl =
      this.configService.get<string>('ANTHROPIC_BASE_URL') ??
      'https://api.anthropic.com';
  }

  async forwardToAnthropic(
    body: Anthropic.MessageCreateParamsNonStreaming,
    incomingHeaders: Record<string, string>,
  ): Promise<Anthropic.Message> {
    if (!body.model || !body.messages) {
      throw new BadRequestException('model and messages are required');
    }

    const authHeader = incomingHeaders['authorization'];
    const apiKey = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : this.apiKey;

    // Base headers - override con lo que el cliente envió
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': incomingHeaders['anthropic-version'] ?? '2023-06-01',
    };
    // Forward todos los headers anthropic-* (beta, etc.)
    for (const [key, value] of Object.entries(incomingHeaders)) {
      if (key.startsWith('anthropic-') && key !== 'anthropic-version') {
        headers[key] = value;
      }
    }

    // Force non-streaming — the proxy parses the full JSON response
    const res = await fetch(`${this.upstreamBaseUrl}/v1/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...body, stream: false }),
    });

    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(`Upstream error ${res.status}: ${errText}`);
      throw new Error(`${res.status} ${errText}`);
    }

    const response = (await res.json()) as Anthropic.Message;

    this.logger.debug(`Response: stop_reason=${response.stop_reason}, content_blocks=${response.content?.length}`);

    const toolUseBlocks = (response.content ?? []).filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );

    if (toolUseBlocks.length === 0) {
      return response;
    }

    this.logger.log(`Intercepted ${toolUseBlocks.length} tool_use block(s)`);

    type BlockVerdict = { block: Anthropic.ToolUseBlock; result: AnalyzeResponseDto };
    const blockVerdicts: BlockVerdict[] = [];
    let worstVerdict: Verdict = Verdict.ALLOW;

    for (const block of toolUseBlocks) {
      this.logger.log(`  → tool: ${block.name}, input: ${JSON.stringify(block.input)}`);
      const result = await this.analyzerService.analyze({
        tool_name: block.name,
        tool_input: block.input as Record<string, unknown>,
        session_id: 'proxy-session',
        cwd: process.cwd(),
      });
      this.logger.log(`  ← verdict: ${result.verdict} (score=${result.risk_score})`);
      blockVerdicts.push({ block, result });
      if (result.verdict === Verdict.BLOCK) worstVerdict = Verdict.BLOCK;
      else if (result.verdict === Verdict.WARN && worstVerdict !== Verdict.BLOCK) worstVerdict = Verdict.WARN;
    }

    if (worstVerdict === Verdict.ALLOW) return response;

    if (worstVerdict === Verdict.BLOCK) {
      const newContent = (response.content ?? []).map(b => {
        if (b.type !== 'tool_use') return b;
        const info = blockVerdicts.find(v => v.block.id === (b as Anthropic.ToolUseBlock).id);
        const patterns = info?.result.detected_patterns.map((p: DetectedPattern) => p.name).join(', ') || info?.result.reason || '';
        return {
          type: 'text' as const,
          text: `🚫 ACTION BLOCKED: Tool '${b.name}' was blocked by security policy.\nDetected: ${patterns}\nRisk score: ${info?.result.risk_score ?? 0}/100`,
        };
      });
      return { ...response, content: newContent, stop_reason: 'end_turn' as const };
    }

    // WARN: insert a text block immediately before each flagged tool_use
    const newContent: Anthropic.ContentBlock[] = [];
    for (const b of response.content ?? []) {
      if (b.type === 'tool_use') {
        const info = blockVerdicts.find(v => v.block.id === (b as Anthropic.ToolUseBlock).id);
        if (info?.result.verdict === Verdict.WARN) {
          const patterns = info.result.detected_patterns.map((p: DetectedPattern) => p.name).join(', ') || info.result.reason;
          newContent.push({
            type: 'text',
            text: `⚠️ SECURITY WARNING: Tool '${b.name}' flagged.\nDetected: ${patterns}\nRisk score: ${info.result.risk_score}/100\nThe action will still execute — review it carefully.`,
          });
        }
      }
      newContent.push(b);
    }
    return { ...response, content: newContent };
  }
}
