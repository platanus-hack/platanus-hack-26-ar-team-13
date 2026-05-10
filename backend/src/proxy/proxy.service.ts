import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { Response } from 'express';
import { AnalyzerService } from '../analyzer/analyzer.service';
import { AuditService } from '../audit/audit.service';
import { Verdict } from '../common/types/verdict.enum';
import { BashToolInput } from '../common/types/tool-input';

import { AnalyzeResponseDto } from '../common/dto/analyze-response.dto';
import { DetectedPattern } from '../common/types/detected-pattern';
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

  async forwardStreaming(
    body: Anthropic.MessageCreateParamsNonStreaming,
    incomingHeaders: Record<string, string>,
    res: Response,
  ): Promise<void> {
    const apiKey = this.extractApiKey(incomingHeaders);

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

    const upstream = await fetch(`${this.upstreamBaseUrl}/v1/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      this.logger.error(`Upstream streaming error ${upstream.status}: ${errText}`);
      res.status(upstream.status).json(JSON.parse(errText));
      return;
    }

    // Bufferear todo el SSE para poder analizar tool_use antes de enviar al cliente
    const reader = upstream.body!.getReader();
    const decoder = new TextDecoder();
    const chunks: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(decoder.decode(value, { stream: true }));
    }
    const rawSSE = chunks.join('');

    // Parsear eventos SSE: cada evento está separado por \n\n
    const events = rawSSE
      .split('\n\n')
      .filter(e => e.trim())
      .map(raw => {
        const lines = raw.split('\n');
        const eventType = lines.find(l => l.startsWith('event:'))?.slice(6).trim() ?? '';
        const dataLine = lines.find(l => l.startsWith('data:'))?.slice(5).trim() ?? '';
        let data: any = null;
        try { data = JSON.parse(dataLine); } catch { /* ping o mensaje sin JSON */ }
        return { raw, eventType, data };
      });

    // Reconstruir tool_use blocks acumulando input_json_delta
    const toolUseMap = new Map<number, { name: string; id: string; inputJson: string }>();
    for (const { eventType, data } of events) {
      if (eventType === 'content_block_start' && data?.content_block?.type === 'tool_use') {
        toolUseMap.set(data.index, { name: data.content_block.name, id: data.content_block.id, inputJson: '' });
      }
      if (eventType === 'content_block_delta' && data?.delta?.type === 'input_json_delta') {
        const entry = toolUseMap.get(data.index);
        if (entry) entry.inputJson += data.delta.partial_json ?? '';
      }
    }

    if (toolUseMap.size === 0) {
      // Sin tool_use: enviar stream tal cual
      this.sendSSE(res, upstream, rawSSE);
      return;
    }

    // Analizar cada tool_use reconstruido
    this.logger.log(`Streaming: intercepted ${toolUseMap.size} tool_use block(s)`);
    const verdicts = new Map<number, { verdict: Verdict; reason: string; score: number }>();
    for (const [idx, block] of toolUseMap.entries()) {
      let input: Record<string, unknown> = {};
      try { input = JSON.parse(block.inputJson); } catch { input = { raw: block.inputJson }; }
      this.logger.log(`  → tool: ${block.name}, input: ${JSON.stringify(input)}`);
      const result = await this.analyzerService.analyze({
        tool_name: block.name,
        tool_input: input,
        session_id: 'proxy-stream',
        cwd: process.cwd(),
      });
      this.logger.log(`  ← verdict: ${result.verdict} (score=${result.risk_score})`);
      verdicts.set(idx, { verdict: result.verdict, reason: result.reason, score: result.risk_score });
    }

    const hasBlock = [...verdicts.values()].some(v => v.verdict === Verdict.BLOCK);
    const hasWarn  = [...verdicts.values()].some(v => v.verdict === Verdict.WARN);

    if (!hasBlock && !hasWarn) {
      this.sendSSE(res, upstream, rawSSE);
      return;
    }

    // Modificar el SSE: reemplazar/inyectar eventos según veredicto
    const blockedIndexes = new Set([...verdicts.entries()]
      .filter(([, v]) => v.verdict === Verdict.BLOCK)
      .map(([idx]) => idx));

    const warnIndexes = new Set([...verdicts.entries()]
      .filter(([, v]) => v.verdict === Verdict.WARN)
      .map(([idx]) => idx));

    // Para WARN: inyectar un text block antes del tool_use
    const warnEvents: string[] = [];
    for (const idx of warnIndexes) {
      const v = verdicts.get(idx)!;
      const tool = toolUseMap.get(idx)!;
      // Insertar un content_block_start de tipo text con el warning
      warnEvents.push(
        `event: content_block_start\ndata: {"type":"content_block_start","index":9${idx},"content_block":{"type":"text","text":""}}\n\nevent: content_block_delta\ndata: {"type":"content_block_delta","index":9${idx},"delta":{"type":"text_delta","text":"⚠️ Security warning for '${tool.name}': ${v.reason} (score: ${v.score}/100)"}}\n\nevent: content_block_stop\ndata: {"type":"content_block_stop","index":9${idx}}`
      );
    }

    const modifiedEvents: string[] = [];
    let textBlockIdx = 0; // para reasignar índices de bloques bloqueados

    for (const { raw, eventType, data } of events) {
      if (!data) { modifiedEvents.push(raw); continue; }

      const idx: number = data.index ?? -1;

      if (blockedIndexes.has(idx)) {
        // Reemplazar content_block_start con un text block que explica el bloqueo
        if (eventType === 'content_block_start') {
          const v = verdicts.get(idx)!;
          const tool = toolUseMap.get(idx)!;
          modifiedEvents.push(
            `event: content_block_start\ndata: {"type":"content_block_start","index":${idx},"content_block":{"type":"text","text":""}}`
          );
          modifiedEvents.push(
            `event: content_block_delta\ndata: {"type":"content_block_delta","index":${idx},"delta":{"type":"text_delta","text":"🚫 Tool '${tool.name}' blocked: ${v.reason} (score: ${v.score}/100)"}}`
          );
          textBlockIdx = idx;
        } else if (eventType === 'content_block_delta' || (eventType === 'content_block_stop' && idx === textBlockIdx)) {
          // Suprimir los deltas originales del tool_use bloqueado (ya los reemplazamos)
          if (eventType === 'content_block_stop') modifiedEvents.push(raw);
          // si es delta, no emitir
        } else {
          modifiedEvents.push(raw);
        }
        continue;
      }

      modifiedEvents.push(raw);
    }

    // Insertar warnings antes del primer tool_use
    const firstToolIdx = modifiedEvents.findIndex(e => e.includes('"tool_use"'));
    if (warnEvents.length > 0 && firstToolIdx !== -1) {
      modifiedEvents.splice(firstToolIdx, 0, ...warnEvents);
    }

    this.sendSSE(res, upstream, modifiedEvents.join('\n\n') + '\n\n');
  }

  private sendSSE(res: Response, upstream: globalThis.Response, body: string): void {
    upstream.headers.forEach((value, key) => {
      if (!['content-encoding', 'transfer-encoding', 'connection', 'content-length'].includes(key)) {
        res.setHeader(key, value);
      }
    });
    res.setHeader('content-type', 'text/event-stream');
    res.status(upstream.status);
    res.write(body);
    res.end();
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
      const key = authHeader.slice(7).trim();
      if (key) return key;
    }

    if (this.configService.get<string>('ALLOW_SERVER_API_KEY_PROXY') === 'true' && this.apiKey) {
      return this.apiKey;
    }

    throw new UnauthorizedException('Authorization: Bearer <Anthropic API key> is required');
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

  private extractToolUseBlocks(response: Anthropic.Message): Anthropic.ToolUseBlock[] {
    return (response.content ?? []).filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );
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

      const command =
        block.name === 'Bash' ? ((block.input as BashToolInput).command ?? null) : null;

      await this.auditService.save({
        company: "Hackan't",
        tool_name: block.name,
        command,
        verdict: result.verdict,
        risk_score: result.risk_score,
      });

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
