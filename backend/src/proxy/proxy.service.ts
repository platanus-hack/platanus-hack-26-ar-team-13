import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AnalyzerService } from '../analyzer/analyzer.service';
import { BashToolInput } from '../common/types/tool-input';
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
  private readonly anthropic: Anthropic;

  constructor(
    private readonly configService: ConfigService,
    private readonly analyzerService: AnalyzerService,
  ) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY') ?? '';
    const baseURL =
      this.configService.get<string>('ANTHROPIC_BASE_URL') ??
      'https://api.anthropic.com';

    this.anthropic = new Anthropic({ apiKey, baseURL });
  }

  /**
   * Forward a CreateMessage request to Anthropic and return an intercepted response.
   *
   * Validation:
   * - `model` must be present (string)
   * - `messages` must be present (array)
   * Throws BadRequestException if either is missing.
   *
   * If authorizationHeader is provided (format "Bearer <key>"), that key is used
   * instead of the configured ANTHROPIC_API_KEY for this request.
   *
   * Implementation notes:
   * - Cast body to Anthropic.MessageCreateParamsNonStreaming before calling SDK
   * - Extract session_id and cwd from body if present (for analysis context)
   * - Call interceptToolUseBlocks on the response content array
   *
   * @throws BadRequestException if model or messages are missing
   * @throws Error if the Anthropic API call fails
   */
  async forwardToAnthropic(
    body: Anthropic.MessageCreateParamsNonStreaming,
  ): Promise<Anthropic.Message> {
    if (!body.model || !body.messages) {
      throw new BadRequestException('model and messages are required');
    }

    // context_management is sent by Claude Code but rejected by older SDK versions
    const { context_management: _, ...params } = body as unknown as Record<string, unknown>;
    const response = await this.anthropic.messages.create(
      params as unknown as Anthropic.MessageCreateParamsNonStreaming,
    );

    if (!body.tools?.length) {
      return response;
    }

    const commands = (response.content ?? [])
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'Bash')
      .map((b) => (b.input as BashToolInput).command);

    console.log('[ProxyService] Terminal commands to analyze:');
    console.log(JSON.stringify(commands, null, 2));

    return response;
  }
}
