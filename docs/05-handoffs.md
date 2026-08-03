# Handoffs (multi-agent delegation)

A handoff lets one agent transfer an in-progress conversation to another, more specialized agent. Handoffs are built on top of the normal tool system — the model sees a handoff as just another callable tool, so it participates naturally in reasoning ("this looks like a weather question, let me hand off to WeatherAgent").

## Setting up a handoff

```ts
import { Agent, OpenAIProvider } from "ayu-agent-sdk";

const provider = new OpenAIProvider({ model: "gpt-4o-mini" });

const weatherAgent = Agent.builder()
  .name("WeatherAgent")
  .instructions("You are a weather specialist.")
  .model(provider)
  .tool(weatherTool)
  .build();

const triageAgent = Agent.builder()
  .name("TriageAgent")
  .instructions("Route weather questions to WeatherAgent. Answer everything else yourself.")
  .model(provider)
  .handoffTo(weatherAgent)   // registers a handoff_to_WeatherAgent tool automatically
  .build();

const result = await triageAgent.run("What's the weather in Jaipur?");
```

When the model calls the `handoff_to_WeatherAgent` tool, `TriageAgent` stops running and `WeatherAgent` takes over the same session, continuing until it produces a final answer (or hands off again).

## What gets preserved

Every handoff tool call requires the model to provide:
- `reason` — why it's handing off
- `contextSummary` — the relevant context to pass forward

That summary becomes the input the next agent sees, and both agents share the same `sessionId`, so session history/memory carries across the handoff.

## Loop prevention

Every run tracks the chain of agent names it has passed through (`HandoffLoopGuard`). If an agent hands off back into a cycle (A → B → A) or the chain exceeds a safety limit (default: 6 hops), the SDK throws a `HandoffLoopError` instead of looping forever.

## Observing handoffs

```ts
triageAgent.events.on("handoff_started", (e) => {
  console.log(`${e.fromAgent} -> ${e.toAgent}`);
});
```

Every handoff is also recorded in the run [trace](./10-tracing.md) with `type: "handoff"`, including the `from`, `to`, and the input passed.

Next: [Guardrails →](./06-guardrails.md)
