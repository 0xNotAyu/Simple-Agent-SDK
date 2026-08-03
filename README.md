# AYU AGENT SDK

**A from-scratch, provider-agnostic TypeScript SDK for building AI agents.**

No wrapping of LangChain, CrewAI, or the OpenAI Agents SDK — the agent loop, tool system, handoffs, guardrails, memory, and tracing are all implemented here from first principles. You still bring your own model API client (OpenAI, Anthropic) and validation library (zod) — the *agent behavior* is ours.

```bash
npm install ayu-agent-sdk
```

```ts
import { Agent, OpenAIProvider, defineTool, z } from "ayu-agent-sdk";

const calculator = defineTool({
  name: "calculator",
  description: "Evaluates arithmetic expressions",
  inputSchema: z.object({ expression: z.string() }),
  execute({ expression }) { return { result: eval(expression) }; },
});

const agent = Agent.builder()
  .name("MathAgent")
  .instructions("You solve math problems using the calculator tool.")
  .model(new OpenAIProvider({ model: "gpt-4o-mini" }))
  .tool(calculator)
  .build();

const result = await agent.run("What is (25 * 4) - 17 / 2?");
console.log(result.output);
```
Hosted docs: `https://ayu-sdk-docs.vercel.app/`
Full docs: [`/docs`](./docs/README.md) · Examples: [`/examples`](./examples)

---

## What's implemented

- ✅ Original agent runtime — accepts input, calls the model, detects tool calls, executes them, feeds results back, loops to a final answer, stops safely on turn limits/timeouts
- ✅ Tools — name/description/zod input schema/typed output/automatic error handling, sync or async
- ✅ Multi-agent handoffs — context-preserving delegation with loop detection
- ✅ Guardrails — input/output/tool validation, PII redaction, approval flow for risky actions
- ✅ Memory & sessions — pluggable `SessionStore` (in-memory, file, or bring your own — SQLite/Redis/etc.), with config/run-state/session-state cleanly separated
- ✅ Structured output — zod schema validation with automatic repair-retry on invalid output
- ✅ Streaming & events — typed event bus + `runStream()` for token-by-token output
- ✅ Tracing — per-run trace with tool calls, handoffs, retries, errors, timing, token usage
- ✅ Reliability — retries with exponential backoff, per-call timeouts, abort signals, safe env-var-only secret handling
- ✅ Model provider abstraction — `OpenAIProvider`, `AnthropicProvider`, `FallbackProvider`, and a documented interface to add more

## Project structure

```
src/
  core/               Agent, AgentBuilder, shared types & errors
  providers/           ModelProvider interface, OpenAI, Anthropic, fallback
  tools/                defineTool(), zod-backed validation
  handoffs/             agent-to-agent delegation + loop guard
  guardrails/           input/output/tool guardrails
  memory/               SessionStore interface + adapters
  structured-output/    schema validation + repair
  streaming/             typed event bus
  tracing/               run traces
  index.ts               public API surface
examples/               3 runnable examples (basic, handoff, streaming)
docs/                   full documentation (see /docs/README.md)
```

## License

MIT
