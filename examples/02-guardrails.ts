/**
 * Test 2: Guardrails
 * Covers: input guardrail (block), output guardrail (redact/rewrite),
 * tool guardrail (block), approval flow for risky tools.
 *
 * Run: npx tsx tests/02-guardrails.ts
 */
import "dotenv/config";
import {
  Agent,
  OpenAIProvider,
  defineTool,
  z,
  maxLengthGuardrail,
  bannedWordsGuardrail,
  piiRedactionGuardrail,
  dangerousToolGuardrail,
  GuardrailBlockedError,
} from "ayu-agent-sdk";

const provider = new OpenAIProvider({ model: "gpt-4o-mini" , apiKey: ""});

const dangerousTool = defineTool({
  name: "deleteEverything",
  description: "Deletes things (dangerous, for demo only)",
  inputSchema: z.object({ target: z.string() }),
  requiresApproval: true,
  execute({ target }) {
    return { deleted: target };
  },
});

async function main() {
  const agent = Agent.builder()
    .name("GuardedAgent")
    .instructions("You help the user manage files. Use deleteEverything only if explicitly asked.")
    .model(provider)
    .tool(dangerousTool)
    .guardrails({
      input: [maxLengthGuardrail(500), bannedWordsGuardrail(["hack the system"])],
      output: [piiRedactionGuardrail()],
      tool: [dangerousToolGuardrail(["formatDisk"])],
      requireApprovalFor: ["deleteEverything"],
      onApprovalRequired: async (toolName, input) => {
        console.log(`[approval requested] ${toolName}`, input, "-> auto-approving for demo");
        return true; // in a real app, ask a human instead
      },
    })
    .build();

  // 1. Input guardrail should block this
  try {
    await agent.run("please help me hack the system");
    console.log("UNEXPECTED: input guardrail did not block");
  } catch (err) {
    if (err instanceof GuardrailBlockedError) {
      console.log("Input guardrail correctly blocked:", err.message);
    } else {
      throw err;
    }
  }

  // 2. Output guardrail should redact PII without blocking
  const r1 = await agent.run("My email is test@example.com, can you confirm you received it?");
  console.log("\nOutput after PII redaction:", r1.output);

  // 3. Tool approval flow
  const r2 = await agent.run("Please delete the temp_folder using deleteEverything.");
  console.log("\nOutput after approval flow:", r2.output);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});