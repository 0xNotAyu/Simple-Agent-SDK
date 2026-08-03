/**
 * Example 1: A single agent with one custom tool.
 * Run with: npm run example:basic
 */
import "dotenv/config";
import { Agent, OpenAIProvider, defineTool, z, maxLengthGuardrail } from "../src/index.js";


const calculatorTool = defineTool({
  name: "calculator",
  description: "Evaluates a basic arithmetic expression, e.g. '2 + 2 * 5'",
  inputSchema: z.object({
    expression: z.string().describe("A basic arithmetic expression using + - * / ()"),
  }),
  execute({ expression }) {
    // Restrict to safe characters only -- never eval() untrusted input directly.
    if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
      throw new Error("Expression contains disallowed characters");
    }
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expression})`)();
    return { expression, result };
  },
});

async function main() {
  const agent = Agent.builder()
    .name("MathAgent")
    .instructions("You are a helpful assistant that solves math problems using the calculator tool.")
    .model(new OpenAIProvider({ model: "gpt-4o-mini" , apiKey: ''}))
    .tool(calculatorTool)
    .guardrails({ input: [maxLengthGuardrail(2000)] })
    .maxTurns(6)
    .build();

  agent.events.on("tool_started", (e) => console.log(`[tool_started] ${e.toolName}`, e.input));
  agent.events.on("tool_completed", (e) => console.log(`[tool_completed] ${e.toolName}`, e.output));

  const result = await agent.run("What is (25 * 4) - 17 / 2?");
  console.log("\nFinal output:", result.output);
  console.log("Turns used:", result.turns);
  console.log("Trace steps:", result.trace.steps.length);
}

main().catch((err) => {
  console.error("Run failed:", err);
  process.exit(1);
});
