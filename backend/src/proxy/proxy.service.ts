import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AnalyzerService } from '../analyzer/analyzer.service';
import { AuditService } from '../audit/audit.service';
import { Verdict } from '../common/types/verdict.enum';
import { BashToolInput } from '../common/types/tool-input';

/**
 * Handles Anthropic API forwarding and tool_use interception.
 *
 * Non-streaming workflow:
 *   1. Validate request has model and messages
 *   2. Forward body verbatim to Anthropic upstream (non-streaming)
 *   3. Receive complete Message response
 *   4. Extract and analyze tool_use blocks with AnalyzerService
 *   5. Apply verdicts:
 *      - ALLOW   → keep unchanged
 *      - WARN    → prepend text warning block
 *      - BLOCK   → replace tool_use with text explanation, set stop_reason to 'end_turn'
 *   6. Persist audit log entry per block
 *   7. Return modified response to client
 *
 * Note: Two Anthropic SDK instances exist:
 * - This service: uses ANTHROPIC_BASE_URL (avoids proxying ourselves)
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
    private readonly auditService: AuditService,
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
    this.validateRequest(body);

    const apiKey = this.extractApiKey(incomingHeaders);
    const headers = this.buildHeaders(apiKey, incomingHeaders);

    const response = await this.callUpstream(headers, body);
    return this.processResponse(response, apiKey);
  }

  private validateRequest(body: Anthropic.MessageCreateParamsNonStreaming): void {
    if (!body.model || !body.messages) {
      throw new BadRequestException('model and messages are required');
    }
  }

  private extractApiKey(incomingHeaders: Record<string, string>): string {
    const authHeader = incomingHeaders['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    return this.apiKey;
  }

  private buildHeaders(
    apiKey: string,
    incomingHeaders: Record<string, string>,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': incomingHeaders['anthropic-version'] ?? '2023-06-01',
    };

    for (const [key, value] of Object.entries(incomingHeaders)) {
      if (key.startsWith('anthropic-') && key !== 'anthropic-version') {
        headers[key] = value;
      }
    }

    return headers;
  }

  private async callUpstream(
    headers: Record<string, string>,
    body: Anthropic.MessageCreateParamsNonStreaming,
  ): Promise<Anthropic.Message> {
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

    return (await res.json()) as Anthropic.Message;
  }

  private async processResponse(
    response: Anthropic.Message,
    apiKey: string,
  ): Promise<Anthropic.Message> {
    this.logger.debug(
      `Response: stop_reason=${response.stop_reason}, content_blocks=${response.content?.length}`,
    );

    const toolUseBlocks = this.extractToolUseBlocks(response);
    if (toolUseBlocks.length === 0) {
      return response;
    }

    this.logger.log(`Intercepted ${toolUseBlocks.length} tool_use block(s)`);

    const { mutableContent, warningBlocks, shouldStopEarly } =
      await this.analyzeAndProcessBlocks(toolUseBlocks, apiKey);

    return {
      ...response,
      content: [...warningBlocks, ...mutableContent],
      stop_reason: shouldStopEarly ? 'end_turn' : response.stop_reason,
    };
  }

  private extractToolUseBlocks(response: Anthropic.Message): Anthropic.ToolUseBlock[] {
    return (response.content ?? []).filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );
  }

  private async analyzeAndProcessBlocks(
    toolUseBlocks: Anthropic.ToolUseBlock[],
    apiKey: string,
  ): Promise<{
    mutableContent: Anthropic.ContentBlock[];
    warningBlocks: Anthropic.TextBlock[];
    shouldStopEarly: boolean;
  }> {
    const mutableContent: Anthropic.ContentBlock[] = [];
    const warningBlocks: Anthropic.TextBlock[] = [];
    let shouldStopEarly = false;

    for (const block of toolUseBlocks) {
      this.logger.log(`  → tool: ${block.name}, input: ${JSON.stringify(block.input)}`);

      const result = await this.analyzerService.analyze({
        tool_name: block.name,
        tool_input: block.input as Record<string, unknown>,
        session_id: 'proxy-session',
        cwd: process.cwd(),
      });

      this.logger.log(`  ← verdict: ${result.verdict} (score=${result.risk_score})`);

      const command =
        block.name === 'Bash' ? ((block.input as BashToolInput).command ?? null) : null;

      await this.auditService.save({
        company: "test company",
        tool_name: block.name,
        command,
        verdict: result.verdict,
        risk_score: result.risk_score,
      });

      if (result.verdict === Verdict.WARN) {
        warningBlocks.push(this.createWarningBlock(block.name, result));
      } else if (result.verdict === Verdict.BLOCK) {
        mutableContent.push(this.createBlockedBlock(block.name, result));
        shouldStopEarly = true;
      } else {
        mutableContent.push(block);
      }
    }

    return { mutableContent, warningBlocks, shouldStopEarly };
  }

  private createWarningBlock(
    toolName: string,
    result: { reason: string; risk_score: number },
  ): Anthropic.TextBlock {
    return {
      type: 'text',
      text: `⚠️ Security warning for tool '${toolName}': ${result.reason} (risk score: ${result.risk_score}/100)`,
    };
  }

  private createBlockedBlock(
    toolName: string,
    result: { reason: string; risk_score: number },
  ): Anthropic.TextBlock {
    return {
      type: 'text',
      text: `🚫 Tool call '${toolName}' was blocked by security policy: ${result.reason} (risk score: ${result.risk_score}/100)`,
    };
  }
}
