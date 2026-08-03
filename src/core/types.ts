//shared types

export type Role = "system" | "user" | "assistant" | "tool"; 

export interface ChatMessage {
  role: Role;
  content: string;
  toolCallId?: string;
  toolName?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface GenerateParams {
  messages: ChatMessage[];
  systemPrompt: string;
  tools: ToolSchema[];
  responseSchema?: JSONSchema | undefined;
}

export interface GenerateResult {
  content: string | null;
  toolCalls: ToolCall[];
  usage: TokenUsage;
  stopReason: "tool_call" | "end_turn" | "max_tokens" | "error";
}

export interface StreamChunk {
  type: "text_delta" | "tool_call" | "end";
  textDelta?: string;
  toolCall?: ToolCall;
}

// JSON schema is intentionally loose here so that providers translate it
// into their own function/tool-calling formats.
export type JSONSchema = Record<string, unknown>;

export interface ToolSchema {
  name: string;
  description: string;
  parameters: JSONSchema;
}

export type RunStatus =
  | "running"
  | "completed"
  | "failed"
  | "max_turns_exceeded"
  | "guardrail_blocked"
  | "handed_off";

export class AgentSDKError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AgentSDKError";
  }
}

export class ToolExecutionError extends AgentSDKError {
  constructor(toolName: string, cause: unknown) {
    super(`Tool "${toolName}" failed to execute`, "TOOL_EXECUTION_ERROR", cause);
  }
}

export class GuardrailBlockedError extends AgentSDKError {
  constructor(stage: "input" | "output" | "tool", reason: string) {
    super(`Guardrail blocked ${stage}: ${reason}`, "GUARDRAIL_BLOCKED");
  }
}

export class MaxTurnsExceededError extends AgentSDKError {
  constructor(maxTurns: number) {
    super(`Agent exceeded max turns (${maxTurns})`, "MAX_TURNS_EXCEEDED");
  }
}

export class HandoffLoopError extends AgentSDKError {
  constructor(chain: string[]) {
    super(`Handoff loop detected: ${chain.join(" -> ")}`, "HANDOFF_LOOP");
  }
}
