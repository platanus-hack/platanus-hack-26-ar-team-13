/** Bash tool input — matches Claude Code Bash tool spec. */
export interface BashToolInput {
  command: string;
  description?: string;
  run_in_background?: boolean;
  timeout?: number;
}

/** Edit tool input — matches Claude Code Edit tool spec. */
export interface EditToolInput {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

/** Write tool input — matches Claude Code Write tool spec. */
export interface WriteToolInput {
  file_path: string;
  content: string;
}

/** Generic MCP tool input — shape is server-defined. */
export interface McpToolInput {
  [key: string]: unknown;
}

/**
 * Discriminated union of all supported tool input shapes.
 * Services narrow to the correct type by inspecting tool_name.
 */
export type ToolInput =
  | BashToolInput
  | EditToolInput
  | WriteToolInput
  | McpToolInput
  | Record<string, unknown>;
