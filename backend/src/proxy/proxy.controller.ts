import { Controller, Post, Body, Headers } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ProxyService } from './proxy.service';

/**
 * Exposes POST /v1/messages — a drop-in replacement for the Anthropic API.
 *
 * Clients configure: ANTHROPIC_BASE_URL=http://localhost:3000
 * The Anthropic SDK then sends all requests through this proxy.
 *
 * Non-streaming only (hackathon scope). Clients must not set stream: true.
 */
@Controller('v1')
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  /**
   * Forward a messages request to the real Anthropic API, intercept
   * tool_use blocks in the response, and return the modified message.
   *
   * The body is not validated by a DTO — it is forwarded as-is to Anthropic
   * to avoid schema drift. Basic presence checks (model, messages) happen in
   * ProxyService.forwardToAnthropic.
   *
   * If the Authorization header is provided (Bearer <key>), it overrides the
   * ANTHROPIC_API_KEY from config — useful when each client has its own key.
   *
   * @param body        - Anthropic CreateMessage request body
   * @param authHeader  - Optional "Bearer sk-ant-..." header
   * @returns Modified Anthropic Message response (tool_use blocks analyzed)
   *
   * @example
   * POST /v1/messages
   * Authorization: Bearer sk-ant-...
   * { "model": "claude-sonnet-4-6", "max_tokens": 1024,
   *   "messages": [{ "role": "user", "content": "list files in /" }] }
   */
  @Post('messages')
  async messages(
    @Body() body: Anthropic.MessageCreateParamsNonStreaming,
    @Headers('authorization') authHeader?: string,
  ): Promise<Anthropic.Message> {
    console.log('Received request body:', JSON.stringify(body, null, 2));
    return this.proxyService.forwardToAnthropic(body, authHeader);
  }
}
