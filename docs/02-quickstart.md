# Quick Start

This walks through building a minimal agent with one tool, end to end.

## 1. Define a tool

Every tool is defined with `defineTool()`, backed by a `zod` schema for input validation:

```ts
import { defineTool, z } from "ayu-agent-sdk";

const calculatorTool = defineTool({
  name: "calculator",
  description: "Evaluates a basic arithmetic expression",
  inputSchema: z.object({
    expression: z.string(),
  }),
  execute({ expression }) {
    // your logic here — validated input, typed output
    return { result: eval(expression) };
  },
});
```

## 2. Build an agent

```ts
import { Agent, OpenAIProvider } from "ayu-agent-sdk";

const agent = Agent.builder()
  .name("MathAgent")
  .instructions("You are a helpful assistant that solves math problems.")
  .model(new OpenAIProvider({ model: "gpt-4o-mini" }))
  .tool(calculatorTool)
  .maxTurns(6)
  .build();
```

## 3. Run it

```ts
const result = await agent.run("What is (25 * 4) - 17 / 2?");
console.log(result.output);   // final text answer
console.log(result.turns);    // how many loop iterations it took
console.log(result.trace);    // full run trace (model calls, tool calls, timing)
```

## 4. Listen to events (optional)

```ts
agent.events.on("tool_started", (e) => console.log("calling", e.toolName, e.input));
agent.events.on("tool_completed", (e) => console.log("got", e.output));
```

## 5. Stream instead of waiting for the full answer (optional)

```ts
for await (const event of agent.runStream("What is 12 * 7?")) {
  if (event.type === "text_delta") process.stdout.write(event.text);
}
```

That's the whole loop: **define tools → build an agent → run() or runStream() → read the result.**

Continue to [Model Providers →](./03-providers.md) or jump straight to [Tools →](./04-tools.md).
