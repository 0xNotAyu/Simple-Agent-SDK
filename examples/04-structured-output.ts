/**
 * Test 4: Structured Output
 * Covers: zod schema validation on the final answer, automatic
 * repair-retry if the model's first attempt is invalid JSON.
 *
 * Run: npx tsx tests/04-structured-output.ts
 */
import "dotenv/config";
import { Agent, OpenAIProvider, z } from "ayu-agent-sdk";

const provider = new OpenAIProvider({ model: "gpt-4o-mini" , apiKey: ""});

const invoiceSchema = z.object({
  vendor: z.string(),
  total: z.number(),
  lineItems: z.array(z.object({ description: z.string(), amount: z.number() })),
});

async function main() {
  const agent = Agent.builder()
    .name("InvoiceExtractor")
    .instructions("Extract structured invoice data from the user's text.")
    .model(provider)
    .structuredOutput(invoiceSchema)
    .build();

  const result = await agent.run(
    "Invoice from Acme Corp: 2x Widget @ $10 each, 1x Gadget @ $30. Total $50."
  );

  const invoice = JSON.parse(result.output);
  console.log("Validated structured output:", invoice);
  console.log("Type-checked shape:", {
    vendor: typeof invoice.vendor,
    total: typeof invoice.total,
    lineItemCount: invoice.lineItems.length,
  });
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});