# Tools

Tools are how an agent takes action beyond generating text. Every tool is created with `defineTool()`.

## Defining a tool

```ts
import { defineTool, z } from "ayu-agent-sdk";

const weatherTool = defineTool({
  name: "getWeather",
  description: "Gets the current weather for a city",
  inputSchema: z.object({
    city: z.string().describe("City name, e.g. 'Jaipur'"),
  }),
  async execute({ city }, ctx) {
    const res = await fetch(`https://wttr.in/${city}?format=%C+%t`);
    return { city, weather: await res.text() };
  },
});
```

- **`inputSchema`** — a zod schema. Input is validated before `execute()` ever runs; invalid input never reaches your code, it returns a structured error to the model instead.
- **`execute`** — sync or async, receives the *validated, typed* input plus a `ToolContext` (`sessionId`, `agentName`, `signal`).
- **Typed output** — whatever you return from `execute` is the typed output; TypeScript infers it end-to-end.

## Error handling

You don't need to try/catch inside `execute`. Any thrown error is automatically caught and turned into a structured failure the agent loop feeds back to the model as a tool error message (and emits a `tool_failed` event) — the whole run doesn't crash because one tool call failed.

```ts
execute({ city }) {
  if (!city) throw new Error("city is required"); // caught & handled automatically
}
```

## Async tools

Just make `execute` async — the agent loop awaits it:

```ts
const dbTool = defineTool({
  name: "lookupUser",
  description: "Looks up a user by id",
  inputSchema: z.object({ id: z.string() }),
  async execute({ id }) {
    return db.users.findOne({ id });
  },
});
```

## Requiring approval before execution

Mark a tool (or list tool names in guardrails) as requiring explicit approval — useful for anything destructive or high-stakes:

```ts
const deleteFileTool = defineTool({
  name: "deleteFile",
  description: "Deletes a file",
  inputSchema: z.object({ path: z.string() }),
  requiresApproval: true,
  execute({ path }) { fs.unlinkSync(path); },
});

const agent = Agent.builder()
  // ...
  .guardrails({
    onApprovalRequired: async (toolName, input) => {
      // e.g. prompt a human, check a policy, etc.
      return await askHumanForApproval(toolName, input);
    },
  })
  .build();
```

## Attaching tools to an agent

```ts
Agent.builder()
  .tool(weatherTool)             // one at a time
  .tools([toolA, toolB, toolC])  // or a batch
  .build();
```

Next: [Handoffs →](./05-handoffs.md)
