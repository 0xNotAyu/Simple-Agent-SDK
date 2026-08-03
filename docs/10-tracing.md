# Tracing

Every `run()` produces a `RunTrace` — a structured, JSON-serializable record of everything that happened, useful for debugging and observability.

```ts
const result = await agent.run("What's 12 * 7, and what's the weather in Jaipur?");
console.log(result.trace);
```

## Shape of a trace

```ts
interface RunTrace {
  runId: string;
  agentName: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "completed" | "failed";
  steps: TraceStep[];
  tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
  finalOutput?: string;
}

interface TraceStep {
  type: "model_call" | "tool_call" | "handoff" | "guardrail" | "retry" | "error";
  timestamp: string;
  durationMs?: number;
  detail: Record<string, unknown>;
}
```

## What gets recorded

- **Tool calls** — name, input, output, duration
- **Handoffs** — from-agent, to-agent, context passed
- **Guardrail triggers** — stage (input/output/tool), reason
- **Retries** — attempt number, error that triggered the retry
- **Errors** — any unhandled failure during the run
- **Token usage** — summed across every model call in the run (including retries and structured-output repair attempts)

## Dumping a trace

```ts
console.log(result.trace.steps.length, "steps recorded");
fs.writeFileSync(`trace-${result.trace.runId}.json`, JSON.stringify(result.trace, null, 2));
```

Trace data never includes raw API keys or secrets — only what flows through messages, tool inputs/outputs, and timing.

Next: [Error Handling →](./11-error-handling.md)
