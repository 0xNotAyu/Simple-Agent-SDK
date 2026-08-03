export interface TraceStep {
  type: "model_call" | "tool_call" | "handoff" | "guardrail" | "retry" | "error";
  timestamp: string;
  durationMs?: number;
  detail: Record<string, unknown>;
}

export interface RunTrace {
  runId: string;
  agentName: string;
  startedAt: string;
  finishedAt?: string;
  steps: TraceStep[];
  tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
  finalOutput?: string;
  status: "running" | "completed" | "failed";
}

/**
 * Collects a structured, inspectable trace of everything that happens
 * during a run: model calls, tool calls, handoffs, retries, errors,
 * timing, and token usage. Traces can be dumped to JSON for debugging
 * or fed into an observability backend.
 */
export class Tracer {
  private trace: RunTrace;

  constructor(runId: string, agentName: string) {
    this.trace = {
      runId,
      agentName,
      startedAt: new Date().toISOString(),
      steps: [],
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      status: "running",
    };
  }

  record(step: Omit<TraceStep, "timestamp">): void {
    this.trace.steps.push({ ...step, timestamp: new Date().toISOString() });
  }

  addUsage(usage: { inputTokens: number; outputTokens: number; totalTokens: number }): void {
    this.trace.tokenUsage.inputTokens += usage.inputTokens;
    this.trace.tokenUsage.outputTokens += usage.outputTokens;
    this.trace.tokenUsage.totalTokens += usage.totalTokens;
  }

  finish(status: "completed" | "failed", finalOutput?: string): RunTrace {
    this.trace.finishedAt = new Date().toISOString();
    this.trace.status = status;
    if (finalOutput !== undefined) this.trace.finalOutput = finalOutput;
    return this.trace;
  }

  get(): RunTrace {
    return this.trace;
  }

  toJSON(): string {
    return JSON.stringify(this.trace, null, 2);
  }
}
