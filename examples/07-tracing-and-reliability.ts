/**
 * Test 7: Tracing & Reliability
 * Covers: run trace (run ID, steps, timing, token usage), retries,
 * timeout configuration.
 *
 * Run: npx tsx tests/07-tracing-and-reliability.ts
 */
import "dotenv/config";
import { Agent, OpenAIProvider } from "ayu-agent-sdk";

const provider = new OpenAIProvider({ model: "gpt-4o-mini" , apiKey: ""});

async function main() {
  const agent = Agent.builder()
    .name("TracedAgent")
    .instructions("You are a helpful assistant.")
    .model(provider)
    .retry({ maxRetries: 2, baseDelayMs: 300 })
    .timeout(30_000)
    .build();

  const result = await agent.run("What's the capital of France?");

  console.log("Run ID:", result.trace.runId);
  console.log("Agent name:", result.trace.agentName);
  console.log("Status:", result.trace.status);
  console.log("Steps recorded:", result.trace.steps.length);
  console.log("Token usage:", result.trace.tokenUsage);
  console.log("Final output (also in trace):", result.trace.finalOutput);
  console.log("\nFull trace JSON:\n", JSON.stringify(result.trace, null, 2));
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});