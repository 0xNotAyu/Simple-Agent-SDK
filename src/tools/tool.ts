import { z, type ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ToolSchema } from "../core/types.js";
import { ToolExecutionError } from "../core/types.js";

export interface ToolContext {
  sessionId: string;
  agentName: string;
  signal?: AbortSignal;
}

export interface ToolResult<TOutput = unknown> {
  ok: boolean;
  output?: TOutput;
  error?: string;
}

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: ZodType<TInput>;
  /** Marks the tool as requiring human/guardrail approval before running. */
  requiresApproval?: boolean;
  execute: (input: TInput, ctx: ToolContext) => Promise<TOutput> | TOutput;
}

/**
 * Defines a tool with typed input validation (via zod), typed output,
 * and centralized error handling. This is the only way tools are
 * created in the SDK -- keeps validation + errors consistent everywhere.
 */
export function defineTool<TInput, TOutput>(
  def: ToolDefinition<TInput, TOutput>
): RunnableTool<TInput, TOutput> {
  return new RunnableTool(def);
}

export class RunnableTool<TInput = unknown, TOutput = unknown> {
  constructor(private readonly def: ToolDefinition<TInput, TOutput>) {}

  get name() {
    return this.def.name;
  }

  get requiresApproval() {
    return this.def.requiresApproval ?? false;
  }

  toSchema(): ToolSchema {
    return {
      name: this.def.name,
      description: this.def.description,
      parameters: zodToJsonSchema(this.def.inputSchema, { target: "openApi3" }) as Record<
        string,
        unknown
      >,
    };
  }

  /** Validates input, runs the tool, and normalizes success/error into a ToolResult. */
  async run(rawInput: unknown, ctx: ToolContext): Promise<ToolResult<TOutput>> {
    const parsed = this.def.inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        ok: false,
        error: `Invalid input for tool "${this.def.name}": ${parsed.error.message}`,
      };
    }

    try {
      const output = await this.def.execute(parsed.data, ctx);
      return { ok: true, output };
    } catch (err) {
      const wrapped = new ToolExecutionError(this.def.name, err);
      return { ok: false, error: wrapped.message + (err instanceof Error ? `: ${err.message}` : "") };
    }
  }
}

// Re-export z so consumers don't need a separate zod dependency for basic use.
export { z };
