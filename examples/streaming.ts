/**
 * Example 3: Streaming a response token-by-token, plus tool events,
 * using agent.runStream() instead of agent.run().
 * Run with: npm run example:stream
 */
import "dotenv/config";
import { Agent, OpenAIProvider, defineTool, z } from "../src/index.js";

const factTool = defineTool({
  name: "randomFact",
  description: "Returns a random fun fact about a topic",
  inputSchema: z.object({ topic: z.string() }),
  execute({ topic }) {
    return { topic, fact: `${topic} is more interesting than most people assume.` };
  },
});

async function main() {
  const agent = Agent.builder()
    .name("StreamingAgent")
    .instructions("You are a friendly assistant. Use randomFact when asked for a fact.")
    .model(new OpenAIProvider({ model: "gpt-4o-mini", apiKey: ''}))
    .tool(factTool)
    .build();

  process.stdout.write("Agent: ");

  const gen = agent.runStream("Tell me a random fact about octopuses.");
  let next = await gen.next();
  while (!next.done) {
    const event = next.value;
    switch (event.type) {
      case "text_delta":
        process.stdout.write(event.text);
        break;
      case "tool_started":
        process.stdout.write(`\n[calling ${event.toolName}...]\n`);
        break;
      case "tool_completed":
        process.stdout.write(`[${event.toolName} done in ${event.durationMs}ms]\n`);
        break;
      default:
        break;
    }
    next = await gen.next();
  }
  const result = next.value; // RunResult, once done === true

  console.log("\n\n(streaming complete) turns used:", result.turns);
}

main().catch((err) => {
  console.error("Run failed:", err);
  process.exit(1);
});
