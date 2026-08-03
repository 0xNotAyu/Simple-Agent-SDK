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

Full docs: [`/docs`](./docs/README.md) · Examples: [`/examples`](./examples)

---

## The Pitch

### Who it's for

Individual developers and small teams building AI features into real products — not researchers who want a notebook, and not enterprises who've already standardized on a heavyweight platform. If you're a JS/TS developer who wants to ship an agent behind an API route by this afternoon, Ayu is for you.

### The problem

Most agent frameworks make one of two mistakes: they're either **too magical** — the agent loop is buried inside a Python-first framework with dozens of abstraction layers, so debugging "why did my agent call the wrong tool" means reading someone else's source — or **too primitive**, a raw `while` loop around a chat completion call with no tool validation, no session model, no guardrails, and no visibility into what happened during a run.

Ayu sits in between: **transparent enough to fully understand, complete enough to ship.**

### Why it should exist

Because "write your own agent loop" is currently a false choice between reinventing everything (memory, tool validation, retries, tracing) from scratch on every project, or importing a framework so large you don't know what it's doing under the hood. A ~2,000-line, fully-typed, provider-agnostic core is small enough to read in an afternoon and complete enough to not need anything else.

### How it differs from existing SDKs

| | Simple Agent SDK | Typical framework |
|---|---|---|
| Core loop | Own implementation, ~one file, readable | Buried across many internal abstractions |
| Provider lock-in | Abstracted from day one (OpenAI, Claude, +your own) | Often one primary provider, others bolted on |
| Tool validation | zod-based, typed input **and** output, automatic error containment | Often untyped or loosely validated |
| State model | Explicit 3-way split: config / run state / session state | Frequently conflated |
| Tracing | Built-in, structured, JSON-dumpable per run | Often requires a separate paid observability product |
| Language | TypeScript-first, real inferred types end-to-end | Many are Python-first with thin JS ports |

### Why developers should adopt it

- **You can read the whole agent loop in one sitting** (`src/core/agent.ts`) — no black box.
- **Type safety from tool input to structured output** — catch mistakes at compile time, not in production logs.
- **No provider lock-in** — swap OpenAI for Claude with one line; add fallback chains for reliability.
- **Batteries included, not batteries mandatory** — guardrails, memory, tracing, and handoffs are there when you need them and invisible when you don't.

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
