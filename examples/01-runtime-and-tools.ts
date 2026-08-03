/**
 * Test 1: Agent Runtime + Tools
 * Covers: agent loop, tool calling, input validation, async tools,
 * error handling, safe stopping (maxTurns).
 *
 * Run: npx tsx tests/01-runtime-and-tools.ts
 */
import "dotenv/config";
import { Agent, OpenAIProvider, defineTool, z, MaxTurnsExceededError } from "ayu-agent-sdk";

const provider = new OpenAIProvider({ model: "gpt-4o-mini" , apiKey: ""});

const calculatorTool = defineTool({
  name: "calculator",
  description: "Evaluates a basic arithmetic expression",
  inputSchema: z.object({ expression: z.string() }),
  execute({ expression }) {
    if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
      throw new Error("disallowed characters"); // tests automatic error handling
    }
    return { expression, result: Function(`"use strict"; return (${expression})`)() };
  },
});

const flakyAsyncTool = defineTool({
  name: "flaky",
  description: "An async tool that sometimes fails, to test error handling",
  inputSchema: z.object({ shouldFail: z.boolean() }),
  async execute({ shouldFail }) {
    await new Promise((r) => setTimeout(r, 50));
    if (shouldFail) throw new Error("simulated async failure");
    return { ok: true };
  },
});

async function main() {
  const agent = Agent.builder()
    .name("MathAgent")
    .instructions("You solve math problems using the calculator tool.")
    .model(provider)
    .tool(calculatorTool)
    .tool(flakyAsyncTool)
    .maxTurns(6)
    .build();

  agent.events.on("tool_started", (e) => console.log(`[tool_started] ${e.toolName}`, e.input));
  agent.events.on("tool_completed", (e) => console.log(`[tool_completed] ${e.toolName}`, e.output));
  agent.events.on("tool_failed", (e) => console.log(`[tool_failed] ${e.toolName}: ${e.error}`));

  const result = await agent.run("What is (25 * 4) - 17 / 2?");
  console.log("\nFinal output:", result.output);
  console.log("Turns used:", result.turns);

  // Tool throws -> run should NOT crash, model gets the error back
  const r2 = await agent.run("Call the flaky tool with shouldFail=true and tell me what happened.");
  console.log("\nSurvived a failing tool call:", r2.output);

  // Safe stopping condition: force a loop, expect MaxTurnsExceededError
  const limitedAgent = Agent.builder()
    .name("LoopingAgent")
    .instructions("Always call the calculator tool with '1+1', no matter what, every single turn.")
    .model(provider)
    .tool(calculatorTool)
    .maxTurns(2)
    .build();

  try {
    await limitedAgent.run("go");
  } catch (err) {
    if (err instanceof MaxTurnsExceededError) {
      console.log("\nCorrectly stopped at max turns:", err.message);
    } else {
      throw err;
    }
  }
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});