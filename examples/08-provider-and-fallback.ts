/**
 * Test 8: Model Providers & Fallback
 * Covers: provider abstraction (swap OpenAI <-> Claude with one line),
 * FallbackProvider (tries providers in order on failure).
 *
 * Run: npx tsx tests/08-providers-and-fallback.ts
 */
import "dotenv/config";
import { Agent, OpenAIProvider, AnthropicProvider, FallbackProvider } from "ayu-agent-sdk";

const openai = new OpenAIProvider({ model: "gpt-4o-mini" , apiKey: ""});

async function main() {
  // Swapping providers is a one-line change -- same Agent API either way.
  if (process.env.ANTHROPIC_API_KEY) {
    const claudeAgent = Agent.builder()
      .name("ClaudeAgent")
      .instructions("You are a helpful assistant.")
      .model(new AnthropicProvider({ model: "claude-sonnet-4-20250514" }))
      .build();
    const r = await claudeAgent.run("Say hi in one sentence.");
    console.log("Claude provider output:", r.output);
  } else {
    console.log("Skipping Claude test -- ANTHROPIC_API_KEY not set.");
  }

  // Fallback: first provider is deliberately broken, second should pick up the slack.
  const brokenProvider = new OpenAIProvider({ model: "gpt-4o-mini", apiKey: "sk-invalid-key" });
  const fallbackProvider = new FallbackProvider([brokenProvider, openai]);

  const fallbackAgent = Agent.builder()
    .name("FallbackAgent")
    .instructions("You are a helpful assistant.")
    .model(fallbackProvider)
    .build();

  const r = await fallbackAgent.run("Say hi in one sentence.");
  console.log("\nFallback provider still succeeded despite broken primary:", r.output);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});