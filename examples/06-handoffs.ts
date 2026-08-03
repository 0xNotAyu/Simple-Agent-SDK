/**
 * Test 5: Streaming & Events
 * Covers: runStream() token-by-token output, event bus.
 *
 * Run: npx tsx tests/05-streaming.ts
 */
import "dotenv/config";
import { Agent, OpenAIProvider } from "ayu-agent-sdk";

const provider = new OpenAIProvider({ model: "gpt-4o-mini" , apiKey: ""});

async function main() {
  const agent = Agent.builder()
    .name("StreamingAgent")
    .instructions("You are a concise assistant.")
    .model(provider)
    .build();

  process.stdout.write("Streamed output: ");

  const gen = agent.runStream("Say hello in exactly five words.");
  let next = await gen.next();
  while (!next.done) {
    if (next.value.type === "text_delta") process.stdout.write(next.value.text);
    next = await gen.next();
  }

  const result = next.value; // RunResult, once the generator is done
  console.log(`\n\n(run completed, turns: ${result.turns}, sessionId: ${result.sessionId})`);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});