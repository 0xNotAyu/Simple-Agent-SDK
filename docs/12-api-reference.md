# API Reference

A concise reference of everything exported from `ayu-agent-sdk`. See the linked guide pages for full explanations and examples.

## Core

### `Agent`
The runtime. Created via `Agent.builder()`, never constructed directly.

| Member | Signature | Description |
|---|---|---|
| `Agent.builder()` | `() => AgentBuilder` | Start building an agent |
| `agent.name` | `string` | Agent's name |
| `agent.events` | `AgentEventBus` | Subscribe to runtime events |
| `agent.run()` | `(input: string, options?: RunOptions) => Promise<RunResult>` | Run to completion |
| `agent.runStream()` | `(input: string, options?: RunOptions) => AsyncGenerator<StreamEvent, RunResult, void>` | Run with live streamed events |

### `AgentBuilder`
Fluent builder, all methods return `this`, terminated by `.build()`.

| Method | Description |
|---|---|
| `.name(string)` | Required. Agent's name (also used as the handoff target identifier) |
| `.instructions(string)` | Required. System prompt |
| `.model(ModelProvider)` | Required. Which provider/model to use |
| `.tool(RunnableTool)` / `.tools(RunnableTool[])` | Attach tools |
| `.guardrails(GuardrailConfig)` | Attach input/output/tool guardrails |
| `.session(SessionStore)` | Attach a session store (default: in-memory) |
| `.maxTurns(number)` | Max loop iterations (default: 15) |
| `.retry({ maxRetries, baseDelayMs })` | Retry config for model calls |
| `.timeout(ms)` | Per-model-call timeout (default: 60000) |
| `.handoffTo(...Agent[])` | Register handoff targets |
| `.structuredOutput(ZodType)` | Enforce a schema on the final answer |
| `.build()` | Returns an `Agent` |

### `RunOptions`
```ts
{ sessionId?: string; signal?: AbortSignal; stream?: boolean }
```

### `RunResult`
```ts
{ output: string; status: "completed"; turns: number; trace: RunTrace; sessionId: string }
```

## Tools

- `defineTool(def: ToolDefinition): RunnableTool` — create a tool
- `z` — re-exported zod, for input schemas
- `ToolDefinition { name, description, inputSchema, execute, requiresApproval? }`
- `ToolContext { sessionId, agentName, signal? }`

## Providers

- `ModelProvider` — interface (`generate`, optional `stream`)
- `OpenAIProvider({ model, apiKey?, baseURL? })`
- `AnthropicProvider({ model, apiKey?, maxTokens? })`
- `FallbackProvider(ModelProvider[])`

## Memory

- `SessionStore` — interface (`get`, `save`, `delete`, `append`)
- `InMemorySessionStore`
- `FileSessionStore(dir: string)`

## Guardrails

- `GuardrailConfig { input?, output?, tool?, requireApprovalFor?, onApprovalRequired? }`
- `maxLengthGuardrail(maxChars)`
- `bannedWordsGuardrail(words[])`
- `piiRedactionGuardrail()`
- `dangerousToolGuardrail(names[])`

## Handoffs

- `createHandoffTool(targetAgentName)` — used internally by `.handoffTo()`
- `HandoffLoopGuard` — cycle/length detection

## Structured Output

- `parseStructuredOutput(schema, rawText)`
- `schemaToJsonSchema(schema)`

## Streaming & Events

- `AgentEventBus` — `.on()`, `.off()`, `.emit()`, `.iterate()`
- `AgentEventMap` — full typed event → payload map
- `StreamEvent` — discriminated union yielded by `runStream()`

## Tracing

- `Tracer` — used internally, exposed for advanced use
- `RunTrace`, `TraceStep`

## Errors

- `AgentSDKError` (base)
- `ToolExecutionError`
- `GuardrailBlockedError`
- `MaxTurnsExceededError`
- `HandoffLoopError`

Next: [Examples →](./13-examples.md)
