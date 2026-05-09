import { Controller, Post, Body } from '@nestjs/common';
import { ToolCallRequestDto } from '../common/dto/tool-call-request.dto';
import { AnalyzeResponseDto } from '../common/dto/analyze-response.dto';
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
  constructor(private readonly analyzerService: AnalyzerService) {}
}
