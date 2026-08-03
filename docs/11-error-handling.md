# Error Handling

Ayu throws typed errors, all extending `AgentSDKError`, so you can catch specific failure modes instead of parsing strings.

```ts
import {
  AgentSDKError,
  ToolExecutionError,
  GuardrailBlockedError,
  MaxTurnsExceededError,
  HandoffLoopError,
} from "ayu-agent-sdk";

try {
  const result = await agent.run(userInput);
} catch (err) {
  if (err instanceof GuardrailBlockedError) {
    // input/output/tool rejected by a guardrail
  } else if (err instanceof MaxTurnsExceededError) {
    // agent hit maxTurns without producing a final answer
  } else if (err instanceof HandoffLoopError) {
    // agents kept handing off in a cycle, or chain got too long
  } else if (err instanceof AgentSDKError) {
    // model call failed after retries, timed out, or was aborted
    console.log(err.code); // "MODEL_CALL_FAILED" | "TIMEOUT" | "ABORTED"
  } else {
    throw err; // truly unexpected
  }
}
```

## Reliability features

| Feature | How to configure | Default |
|---|---|---|
| Retries | `.retry({ maxRetries, baseDelayMs })` | 2 retries, 500ms base (exponential backoff) |
| Timeout | `.timeout(ms)` | 60,000ms per model call |
| Max turns | `.maxTurns(n)` | 15 |
| Abort | pass `{ signal }` to `run()`/`runStream()` | — |

```ts
const agent = Agent.builder()
  // ...
  .retry({ maxRetries: 3, baseDelayMs: 1000 })
  .timeout(30_000)
  .maxTurns(10)
  .build();

const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);
await agent.run("...", { signal: controller.signal });
```

## Tool errors don't crash the run

If a tool throws, the agent loop catches it, wraps it in a `ToolExecutionError`, feeds a structured error message back to the model (so it can retry, use a different tool, or explain the failure to the user), and emits a `tool_failed` event. The overall run continues.

## Secrets

- API keys are only ever read from constructor args or `process.env` — never hardcoded, never logged.
- Trace output (`RunTrace`) and events never include provider credentials.
- When writing your own `SessionStore` or provider, avoid persisting raw API keys in session/trace data.

Next: [API Reference →](./12-api-reference.md)
