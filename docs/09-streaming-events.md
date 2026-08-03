# Streaming & Events

Ayu exposes runtime events two ways: a low-level typed **event bus** (always available, on every `Agent`), and a high-level **`runStream()`** async generator built on top of it for token-by-token output.

## Event bus

Every agent has `agent.events`, an `AgentEventBus`. Subscribe with `.on()`:

```ts
agent.events.on("tool_started", (e) => console.log(e.toolName, e.input));
agent.events.on("tool_completed", (e) => console.log(e.toolName, e.output, e.durationMs));
agent.events.on("tool_failed", (e) => console.log(e.toolName, e.error));
agent.events.on("handoff_started", (e) => console.log(e.fromAgent, "->", e.toAgent));
agent.events.on("guardrail_triggered", (e) => console.log(e.stage, e.reason));
agent.events.on("approval_required", (e) => console.log(e.toolName, e.input));
agent.events.on("run_completed", (e) => console.log(e.output, e.turns));
agent.events.on("run_failed", (e) => console.log(e.error));
agent.events.on("turn_started", (e) => console.log("turn", e.turn));
agent.events.on("text_delta", (e) => process.stdout.write(e.text)); // only fires during streaming
```

Full event list is typed in `AgentEventMap` — your editor will autocomplete both event names and payload shapes.

## `runStream()` — token-by-token output

For providers that implement `.stream()` (built-in: `OpenAIProvider`), `runStream()` yields text as it's generated, interleaved with tool/handoff/guardrail events, and returns the final `RunResult` when the generator completes:

```ts
const gen = agent.runStream("Tell me a joke, then look up the weather in Jaipur.");
let next = await gen.next();
while (!next.done) {
  const event = next.value;
  if (event.type === "text_delta") process.stdout.write(event.text);
  if (event.type === "tool_started") console.log(`\n[calling ${event.toolName}]`);
  next = await gen.next();
}
const result = next.value; // RunResult
```

> Note: `for await (const event of agent.runStream(...))` also works for consuming events, but JavaScript's `for-await` discards the generator's final return value — use the manual `.next()` loop above (or wrap in your own promise) if you need the final `RunResult` object, not just the event stream.

If the underlying provider doesn't implement `.stream()`, `runStream()` still works — it just won't emit `text_delta` events (the model call happens as one non-streamed `generate()`), while all other events (tool/handoff/guardrail/turn) still fire normally.

## Async iteration over a single event type

For advanced use cases, you can also iterate one event type directly:

```ts
for await (const toolEvent of agent.events.iterate("tool_completed")) {
  console.log(toolEvent);
}
```

Next: [Tracing →](./10-tracing.md)
