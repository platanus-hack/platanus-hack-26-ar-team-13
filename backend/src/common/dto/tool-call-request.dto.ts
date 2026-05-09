import { IsString, IsNotEmpty, IsObject } from 'class-validator';
import { ToolInput } from '../types/tool-input';

/**
 * Payload sent by Claude Code PreToolUse hooks to POST /analyze.
 *
 * tool_name follows the pattern:
 *   built-ins → 'Bash' | 'Edit' | 'Write' | 'Read' | ...
 *   MCP tools → 'mcp__<server>__<tool>'
 */
export class ToolCallRequestDto {
  /**
   * Name of the tool being invoked.
   * Not constrained to an enum because MCP tool names are open-ended.
   */
  @IsString()
  @IsNotEmpty()
  tool_name!: string;

  /**
   * Input payload for the tool. Shape varies by tool_name.
   * Rule engine and analyzer services narrow this to the correct subtype.
   */
  @IsObject()
  @IsNotEmpty()
  tool_input!: ToolInput;

  /** Session identifier from Claude Code — used for logging and audit. */
  @IsString()
  @IsNotEmpty()
  session_id!: string;

  /** Working directory at time of tool invocation — used for path analysis. */
  @IsString()
  @IsNotEmpty()
  cwd!: string;
}
