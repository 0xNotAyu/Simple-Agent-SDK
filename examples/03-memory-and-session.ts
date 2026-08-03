/**
 * Test 3: Memory & Sessions
 * Covers: multi-turn recall via sessionId, in-memory store,
 * file-based persistent store.
 *
 * Run: npx tsx tests/03-memory-and-sessions.ts
 */
import "dotenv/config";
import { Agent, OpenAIProvider, InMemorySessionStore, FileSessionStore } from "ayu-agent-sdk";

const provider = new OpenAIProvider({ model: "gpt-4o-mini" , apiKey: ""});

async function main() {
  const agent = Agent.builder()
    .name("MemoryAgent")
    .instructions("Remember what the user tells you across turns.")
    .model(provider)
    .session(new InMemorySessionStore()) // default; swap for FileSessionStore below to persist
    .build();

  const r1 = await agent.run("My name is Aayush and I'm building an agent SDK.");
  console.log("Turn 1:", r1.output);

  const r2 = await agent.run("What's my name and what am I building?", { sessionId: r1.sessionId });
  console.log("\nTurn 2 (same session, should recall):", r2.output);

  // Persistent file-based session -- survives process restarts
  const persistentAgent = Agent.builder()
    .name("PersistentAgent")
    .instructions("You are a helpful assistant.")
    .model(provider)
    .session(new FileSessionStore("./sessions"))
    .build();

  const r3 = await persistentAgent.run("Remember the number 42.", { sessionId: "demo-session-1" });
  console.log("\nSaved to file session store at ./sessions, sessionId:", r3.sessionId);
  console.log("Run this file again with the same sessionId to prove it persisted across runs.");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});