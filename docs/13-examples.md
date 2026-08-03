# Examples

All examples live in `/examples` in the repo and can be run directly with `tsx` (no build step needed).

```bash
npm install
echo "OPENAI_API_KEY=sk-..." > .env
```

## 1. Basic agent with a tool — `examples/basic-agent.ts`

A single agent with a `calculator` tool and an input guardrail. Demonstrates the core loop, tool execution, and events.

```bash
npm run example:basic
```

## 2. Multi-agent handoff — `examples/multi-agent-handoff.ts`

A `TriageAgent` that hands off weather questions to a specialist `WeatherAgent`, sharing session state across the handoff.

```bash
npm run example:handoff
```

## 3. Streaming — `examples/streaming.ts`

Streams the agent's response token-by-token via `runStream()`, while also handling a tool call mid-stream.

```bash
npm run example:stream
```

---

Each example is self-contained and heavily commented — read the source alongside running it. They're also the fastest way to confirm your `.env` / API keys are set up correctly.
