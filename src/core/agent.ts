import { randomUUID } from "crypto";
import type { ModelProvider } from "../providers/provider.js";
import type { RunnableTool, ToolContext } from "../tools/tool.js";
import { createHandoffTool, HandoffLoopGuard } from "../handoffs/handoff.js";
import {
  runInputGuardrails,
  runOutputGuardrails,
  runToolGuardrails,
  type GuardrailConfig,
} from "../guardrails/guardrail.js";
import { InMemorySessionStore, type SessionStore } from "../memory/session.js";
import { AgentEventBus, type AgentEventMap, type AgentEventName, type StreamEvent } from "../streaming/events.js";
import { Tracer, type RunTrace } from "../tracing/tracer.js";
import { parseStructuredOutput, schemaToJsonSchema } from "../structured-output/schema.js";
import type { ZodType } from "zod";
import {
  AgentSDKError,
  GuardrailBlockedError,
  HandoffLoopError,
  MaxTurnsExceededError,
  type ChatMessage,
} from "./types.js";

export interface RetryConfig {
  maxRetries?: number;
  baseDelayMs?: number;
}

export interface AgentConfig {
  name: string;
  instructions: string;
  provider: ModelProvider;
  tools?: RunnableTool[];
  guardrails?: GuardrailConfig;
  sessionStore?: SessionStore;
  maxTurns?: number;
  retry?: RetryConfig;
  timeoutMs?: number;
  handoffTargets?: Agent[];
  structuredOutputSchema?: ZodType<unknown>;
}

export interface RunOptions {
  sessionId?: string;
  signal?: AbortSignal;
  stream?: boolean;
}

export interface RunResult<T = string> {
  output: T;
  status: "completed";
  turns: number;
  trace: RunTrace;
  sessionId: string;
}

/**
 * AgentBuilder gives a fluent, chainable API for configuring an agent
 * without exposing a giant constructor. `.build()` produces an
 * immutable-ish Agent instance ready to `.run()`.
 */
export class AgentBuilder {
  private config: Partial<AgentConfig> = { tools: [] };

  name(name: string): this {
    this.config.name = name;
    return this;
  }

  instructions(instructions: string): this {
    this.config.instructions = instructions;
    return this;
  }

  model(provider: ModelProvider): this {
    this.config.provider = provider;
    return this;
  }


  tool(tool: RunnableTool<any, any>): this {
    this.config.tools = [...(this.config.tools ?? []), tool as RunnableTool];
    return this;
  }


  tools(tools: RunnableTool<any, any>[]): this {
    this.config.tools = [...(this.config.tools ?? []), ...(tools as RunnableTool[])];
    return this;
  }

  guardrails(guardrails: GuardrailConfig): this {
    this.config.guardrails = guardrails;
    return this;
  }

  session(store: SessionStore): this {
    this.config.sessionStore = store;
    return this;
  }

  maxTurns(n: number): this {
    this.config.maxTurns = n;
    return this;
  }

  retry(config: RetryConfig): this {
    this.config.retry = config;
    return this;
  }

  timeout(ms: number): this {
    this.config.timeoutMs = ms;
    return this;
  }

  handoffTo(...agents: Agent[]): this {
    this.config.handoffTargets = [...(this.config.handoffTargets ?? []), ...agents];
    return this;
  }

  structuredOutput(schema: ZodType<unknown>): this {
    this.config.structuredOutputSchema = schema;
    return this;
  }

  build(): Agent {
    if (!this.config.name) throw new Error("Agent requires a name");
    if (!this.config.instructions) throw new Error("Agent requires instructions");
    if (!this.config.provider) throw new Error("Agent requires a model provider");
    return new Agent(this.config as AgentConfig);
  }
}

/**
 * Agent is the runtime: it owns the agent loop, tool execution,
 * guardrail enforcement, handoffs, session state, tracing, and events.
 * It never talks to a specific LLM SDK directly -- only through the
 * ModelProvider abstraction.
 */
export class Agent {
  public readonly name: string;
  public readonly events = new AgentEventBus();

  private readonly instructions: string;
  private readonly provider: ModelProvider;
  private readonly toolMap = new Map<string, RunnableTool>();
  private readonly guardrails?: GuardrailConfig;
  private readonly sessionStore: SessionStore;
  private readonly maxTurns: number;
  private readonly retryConfig: Required<RetryConfig>;
  private readonly timeoutMs: number;
  private readonly handoffTargets: Map<string, Agent> = new Map();
  private readonly structuredOutputSchema?: ZodType<unknown>;

  constructor(config: AgentConfig) {
    this.name = config.name;
    this.instructions = config.instructions;
    this.provider = config.provider;
    this.guardrails = config.guardrails;
    this.sessionStore = config.sessionStore ?? new InMemorySessionStore();
    this.maxTurns = config.maxTurns ?? 15;
    this.retryConfig = {
      maxRetries: config.retry?.maxRetries ?? 2,
      baseDelayMs: config.retry?.baseDelayMs ?? 500,
    };
    this.timeoutMs = config.timeoutMs ?? 60_000;
    this.structuredOutputSchema = config.structuredOutputSchema;

    for (const t of config.tools ?? []) this.toolMap.set(t.name, t);

    for (const target of config.handoffTargets ?? []) {
      this.handoffTargets.set(target.name, target);
      const handoffTool = createHandoffTool(target.name);
      this.toolMap.set(handoffTool.name, handoffTool);
    }
  }

  static builder(): AgentBuilder {
    return new AgentBuilder();
  }

  // Runs the full agent loop until a final answer, error, or limit is hit.
  async run(userInput: string, options: RunOptions = {}): Promise<RunResult> {
    return this.runInternal(userInput, options, new HandoffLoopGuard());
  }

  /**
   * Same as `run()`, but yields live events (text deltas, tool lifecycle,
   * handoffs, guardrail triggers, turns) as they happen, and returns the
   * final RunResult once the generator completes. Requires a provider
   * with `.stream()` implemented to get real token-by-token text deltas;
   * other events (tool_started, etc.) are still emitted regardless.
   *
   * Usage:
   *   for await (const event of agent.runStream("hi")) { ... }
   */
  async *runStream(
    userInput: string,
    options: RunOptions = {}
  ): AsyncGenerator<StreamEvent, RunResult, void> {
    const queue: StreamEvent[] = [];
    let wake: (() => void) | null = null;
    let finished = false;

    const push = (event: StreamEvent) => {
      queue.push(event);
      if (wake) {
        wake();
        wake = null;
      }
    };

    const offFns: Array<() => void> = [];
    const listen = <K extends AgentEventName>(
      name: K,
      toEvent: (payload: AgentEventMap[K]) => StreamEvent
    ) => {
      const handler = (payload: AgentEventMap[K]) => push(toEvent(payload));
      this.events.on(name, handler);
      offFns.push(() => this.events.off(name, handler));
    };

    listen("text_delta", (p) => ({ type: "text_delta", ...p }));
    listen("turn_started", (p) => ({ type: "turn_started", ...p }));
    listen("tool_started", (p) => ({ type: "tool_started", ...p }));
    listen("tool_completed", (p) => ({ type: "tool_completed", ...p }));
    listen("tool_failed", (p) => ({ type: "tool_failed", ...p }));
    listen("handoff_started", (p) => ({ type: "handoff_started", ...p }));
    listen("guardrail_triggered", (p) => ({ type: "guardrail_triggered", ...p }));
    listen("approval_required", (p) => ({ type: "approval_required", ...p }));

    const runPromise = this.run(userInput, { ...options, stream: true });
    runPromise.finally(() => {
      finished = true;
      for (const off of offFns) off();
      if (wake) {
        wake();
        wake = null;
      }
    });

    try {
      while (true) {
        if (queue.length > 0) {
          yield queue.shift()!;
          continue;
        }
        if (finished) break;
        await new Promise<void>((resolve) => (wake = resolve));
      }
    } finally {
      for (const off of offFns) off();
    }

    return runPromise;
  }

  private async runInternal(
    userInput: string,
    options: RunOptions,
    loopGuard: HandoffLoopGuard
  ): Promise<RunResult> {
    const sessionId = options.sessionId ?? randomUUID();
    const runId = randomUUID();
    const tracer = new Tracer(runId, this.name);

    const guard = loopGuard.visit(this.name);
    if (!guard.ok) {
      throw new HandoffLoopError(guard.chain);
    }

    // --- input guardrails -------------------------------------------------
    const inputCheck = await runInputGuardrails(this.guardrails?.input, userInput);
    if (!inputCheck.pass) {
      this.events.emit("guardrail_triggered", { stage: "input", reason: inputCheck.reason ?? "blocked" });
      tracer.record({ type: "guardrail", detail: { stage: "input", reason: inputCheck.reason } });
      tracer.finish("failed");
      throw new GuardrailBlockedError("input", inputCheck.reason ?? "input rejected");
    }

    const session = await this.sessionStore.get(sessionId);
    const history: ChatMessage[] = session ? [...session.history] : [];
    history.push({ role: "user", content: userInput });

    let turns = 0;
    try {
      while (turns < this.maxTurns) {
        turns++;
        this.events.emit("turn_started", { turn: turns });

        const result = await this.callModelWithRetry(history, tracer, options.signal, options.stream ?? false);
        tracer.addUsage(result.usage);

        if (result.toolCalls.length === 0) {
          // Final answer branch
          let finalText = result.content ?? "";

          if (this.structuredOutputSchema) {
            const parsed = parseStructuredOutput(this.structuredOutputSchema, finalText);
            if (!parsed.success) {
              // ask the model to repair its own output
              history.push({ role: "assistant", content: finalText });
              history.push({
                role: "user",
                content: `Your previous output failed schema validation: ${parsed.error}. Return ONLY valid JSON matching the required schema.`,
              });
              tracer.record({ type: "retry", detail: { reason: "structured_output_repair" } });
              continue;
            }
          }

          const outputCheck = await runOutputGuardrails(this.guardrails?.output, finalText);
          if (!outputCheck.result.pass) {
            this.events.emit("guardrail_triggered", {
              stage: "output",
              reason: outputCheck.result.reason ?? "blocked",
            });
            tracer.record({ type: "guardrail", detail: { stage: "output", reason: outputCheck.result.reason } });
            tracer.finish("failed");
            throw new GuardrailBlockedError("output", outputCheck.result.reason ?? "output rejected");
          }
          finalText = outputCheck.finalContent;

          history.push({ role: "assistant", content: finalText });
          await this.sessionStore.append(sessionId, history.slice(session ? session.history.length : 0));

          this.events.emit("run_completed", { output: finalText, turns });
          tracer.finish("completed", finalText);

          return { output: finalText, status: "completed", turns, trace: tracer.get(), sessionId };
        }

        // Tool-call branch
        history.push({ role: "assistant", content: result.content ?? "", toolCalls: result.toolCalls });

        for (const call of result.toolCalls) {
          // Handoff interception
          if (call.name.startsWith("handoff_to_")) {
            const targetName = call.name.replace("handoff_to_", "");
            const targetAgent = this.handoffTargets.get(targetName);
            if (targetAgent) {
              this.events.emit("handoff_started", { fromAgent: this.name, toAgent: targetName });
              tracer.record({ type: "handoff", detail: { from: this.name, to: targetName, input: call.input } });
              tracer.finish("completed");

              const contextSummary =
                typeof call.input === "object" && call.input && "contextSummary" in call.input
                  ? String((call.input as Record<string, unknown>).contextSummary)
                  : userInput;

              return targetAgent.runInternal(contextSummary, { ...options, sessionId }, loopGuard);
            }
          }

          const toolStart = Date.now();
          const tool = this.toolMap.get(call.name);

          if (!tool) {
            history.push({
              role: "tool",
              content: `Error: tool "${call.name}" does not exist`,
              toolCallId: call.id,
              toolName: call.name,
            });
            continue;
          }

          const toolGuardCheck = await runToolGuardrails(this.guardrails?.tool, call.name, call.input);
          if (!toolGuardCheck.pass) {
            this.events.emit("guardrail_triggered", {
              stage: "tool",
              reason: toolGuardCheck.reason ?? "blocked",
            });
            history.push({
              role: "tool",
              content: `Tool call blocked by guardrail: ${toolGuardCheck.reason}`,
              toolCallId: call.id,
              toolName: call.name,
            });
            continue;
          }

          if (
            tool.requiresApproval ||
            this.guardrails?.requireApprovalFor?.includes(call.name)
          ) {
            this.events.emit("approval_required", { toolName: call.name, input: call.input });
            const approved = (await this.guardrails?.onApprovalRequired?.(call.name, call.input)) ?? false;
            if (!approved) {
              history.push({
                role: "tool",
                content: `Tool call denied: approval required and not granted for "${call.name}"`,
                toolCallId: call.id,
                toolName: call.name,
              });
              continue;
            }
          }

          this.events.emit("tool_started", { toolName: call.name, input: call.input, toolCallId: call.id });

          const ctx: ToolContext = { sessionId, agentName: this.name, signal: options.signal };
          const toolResult = await tool.run(call.input, ctx);
          const durationMs = Date.now() - toolStart;

          if (toolResult.ok) {
            this.events.emit("tool_completed", {
              toolName: call.name,
              output: toolResult.output,
              toolCallId: call.id,
              durationMs,
            });
            tracer.record({
              type: "tool_call",
              durationMs,
              detail: { name: call.name, input: call.input, output: toolResult.output },
            });
            history.push({
              role: "tool",
              content: JSON.stringify(toolResult.output),
              toolCallId: call.id,
              toolName: call.name,
            });
          } else {
            this.events.emit("tool_failed", {
              toolName: call.name,
              error: toolResult.error ?? "unknown error",
              toolCallId: call.id,
            });
            tracer.record({
              type: "error",
              durationMs,
              detail: { name: call.name, error: toolResult.error },
            });
            history.push({
              role: "tool",
              content: `Error: ${toolResult.error}`,
              toolCallId: call.id,
              toolName: call.name,
            });
          }
        }
      }

      tracer.finish("failed");
      this.events.emit("run_failed", { error: `Max turns (${this.maxTurns}) exceeded` });
      throw new MaxTurnsExceededError(this.maxTurns);
    } catch (err) {
      if (!(err instanceof AgentSDKError)) {
        tracer.record({ type: "error", detail: { message: err instanceof Error ? err.message : String(err) } });
        tracer.finish("failed");
        this.events.emit("run_failed", { error: err instanceof Error ? err.message : String(err) });
      }
      throw err;
    }
  }

  private async callModelWithRetry(
    history: ChatMessage[],
    tracer: Tracer,
    signal: AbortSignal | undefined,
    useStream: boolean
  ) {
    const toolSchemas = [...this.toolMap.values()].map((t) => t.toSchema());
    const params = {
      messages: history,
      systemPrompt: this.instructions,
      tools: toolSchemas,
      responseSchema: this.structuredOutputSchema
        ? schemaToJsonSchema(this.structuredOutputSchema)
        : undefined,
    };

    const canStream = useStream && typeof this.provider.stream === "function";

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      if (signal?.aborted) throw new AgentSDKError("Run aborted", "ABORTED");
      try {
        if (canStream) {
          return await this.withTimeout(this.consumeStream(params), this.timeoutMs);
        }
        return await this.withTimeout(this.provider.generate(params), this.timeoutMs);
      } catch (err) {
        lastError = err;
        tracer.record({
          type: "retry",
          detail: { attempt, error: err instanceof Error ? err.message : String(err) },
        });
        if (attempt < this.retryConfig.maxRetries) {
          await sleep(this.retryConfig.baseDelayMs * Math.pow(2, attempt));
        }
      }
    }
    throw new AgentSDKError(
      `Model call failed after ${this.retryConfig.maxRetries + 1} attempts`,
      "MODEL_CALL_FAILED",
      lastError
    );
  }

  /**
   * Drains a provider's token stream, emitting `text_delta` events as
   * chunks arrive, and returns the same GenerateResult shape a
   * non-streaming `generate()` call would -- so the rest of the agent
   * loop (tool detection, structured output, guardrails) doesn't need
   * to know or care whether streaming was used.
   */
  private async consumeStream(params: Parameters<ModelProvider["generate"]>[0]) {
    const generator = this.provider.stream!(params);
    let next = await generator.next();
    while (!next.done) {
      const chunk = next.value;
      if (chunk.type === "text_delta" && chunk.textDelta) {
        this.events.emit("text_delta", { text: chunk.textDelta });
      }
      next = await generator.next();
    }
    // `next.value` is now the generator's return value (the final GenerateResult)
    return next.value;
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new AgentSDKError(`Model call timed out after ${ms}ms`, "TIMEOUT")), ms);
      promise.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        }
      );
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
