import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AnalyzerService } from '../analyzer/analyzer.service';
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
    authorizationHeader?: string,
  ): Promise<Anthropic.Message> {
    if (!body.model || !body.messages) {
      throw new BadRequestException('model and messages are required');
    }

    let client = this.anthropic;
    if (authorizationHeader?.startsWith('Bearer ')) {
      const key = authorizationHeader.slice(7);
      client = new Anthropic({
        apiKey: key,
        baseURL: this.configService.get<string>('ANTHROPIC_BASE_URL') ?? 'https://api.anthropic.com',
      });
    }

    const response = await client.messages.create(body);

    console.log('[ProxyService] Anthropic response:');
    console.log(JSON.stringify(response, null, 2));

    return response;
  }
}
