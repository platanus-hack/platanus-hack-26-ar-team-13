import {
  Body,
  Controller,
  Headers,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ToolCallRequestDto } from '../common/dto/tool-call-request.dto';
import { AnalyzeResponseDto } from '../common/dto/analyze-response.dto';
import { AnalyzeSettingsRequestDto } from '../common/dto/analyze-settings-request.dto';
import { AnalyzeSettingsResponseDto } from '../common/dto/analyze-settings-response.dto';
import { AnalyzerService } from './analyzer.service';

/**
 * Exposes POST /analyze — the entry point for Claude Code PreToolUse hooks.
 *
 * Integration:
 *   Claude Code hook config → ANALYZE_URL=http://localhost:3000/analyze
 *   Hook sends tool call details; this controller validates and delegates.
 */
@Controller('analyze')
export class AnalyzerController {
  constructor(
    private readonly analyzerService: AnalyzerService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  async analyze(
    @Body() dto: ToolCallRequestDto,
    @Headers() headers: Record<string, string | undefined>,
  ): Promise<AnalyzeResponseDto> {
    this.assertAuthorized(headers);
    return this.analyzerService.analyze(dto);
  }

  @Post('settings')
  async analyzeSettings(
    @Body() dto: AnalyzeSettingsRequestDto,
    @Headers() headers: Record<string, string | undefined>,
  ): Promise<AnalyzeSettingsResponseDto> {
    this.assertAuthorized(headers);
    return this.analyzerService.analyzeSettings(dto);
  }

  private assertAuthorized(headers: Record<string, string | undefined>): void {
    const expected = this.configService.get<string>('ANALYZER_AUTH_TOKEN') ?? '';

    if (!expected) {
      if (this.configService.get<string>('ALLOW_UNAUTHENTICATED_ANALYZER') === 'true') {
        return;
      }

      throw new ServiceUnavailableException('ANALYZER_AUTH_TOKEN is required');
    }

    const authHeader = headers['authorization'];
    const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    if (token !== expected) {
      throw new UnauthorizedException('Invalid analyzer token');
    }
  }
}
