import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ToolCallRequestDto } from '../common/dto/tool-call-request.dto';
import { AnalyzeResponseDto } from '../common/dto/analyze-response.dto';
import { AnalyzeSettingsRequestDto } from '../common/dto/analyze-settings-request.dto';
import { AnalyzeSettingsResponseDto } from '../common/dto/analyze-settings-response.dto';
import { AnalyzerService } from './analyzer.service';
import { ApiKeyGuard } from '../auth/api-key.guard';

/**
 * Exposes POST /analyze — the entry point for Claude Code PreToolUse hooks.
 *
 * Integration:
 *   Claude Code hook config → ANALYZE_URL=http://localhost:3000/analyze
 *   Hook sends tool call details; this controller validates and delegates.
 *
 * All routes require a valid API key via: Authorization: Bearer <api-key>
 */
@UseGuards(ApiKeyGuard)
@Controller('analyze')
export class AnalyzerController {
  constructor(private readonly analyzerService: AnalyzerService) {}

  @Post()
  async analyze(@Body() dto: ToolCallRequestDto): Promise<AnalyzeResponseDto> {
    return this.analyzerService.analyze(dto);
  }

  @Post('settings')
  async analyzeSettings(@Body() dto: AnalyzeSettingsRequestDto): Promise<AnalyzeSettingsResponseDto> {
    return this.analyzerService.analyzeSettings(dto);
  }
}
