# Structured Output

Force an agent's final answer to match a schema instead of freeform text.

## Defining a schema

```ts
import { Agent, OpenAIProvider, z } from "ayu-agent-sdk";

const invoiceSchema = z.object({
  vendor: z.string(),
  total: z.number(),
  lineItems: z.array(z.object({ description: z.string(), amount: z.number() })),
});

const agent = Agent.builder()
  .name("InvoiceExtractor")
  .instructions("Extract structured invoice data from the user's text.")
  .model(new OpenAIProvider({ model: "gpt-4o-mini" }))
  .structuredOutput(invoiceSchema)
  .build();

const result = await agent.run("Invoice from Acme Corp: 2x Widget @ $10, 1x Gadget @ $30. Total $50.");
const invoice = JSON.parse(result.output); // matches invoiceSchema, validated
```

## How it works

1. The zod schema is converted to JSON Schema and sent to the provider (OpenAI's native `response_format: json_schema` when using `OpenAIProvider`).
2. When the model returns a final answer, Ayu parses it as JSON and validates it against the same zod schema.
3. **If validation fails**, instead of returning garbage, the SDK automatically appends a repair message ("Your previous output failed schema validation: `<error>`. Return ONLY valid JSON matching the schema.") and lets the model try again, up to your configured turn limit.
4. Only schema-valid output is ever returned from `run()`.

## Validation errors

If you want to inspect a failure yourself (e.g. building your own repair strategy), the low-level helper is exported too:

```ts
import { parseStructuredOutput } from "ayu-agent-sdk";

const check = parseStructuredOutput(invoiceSchema, rawModelText);
if (!check.success) {
  console.log(check.error); // human-readable zod validation error
}
```

## TypeScript types

Because `structuredOutput()` takes a `ZodType<T>`, you get compile-time types for free — infer the shape with `z.infer`:

```ts
type Invoice = z.infer<typeof invoiceSchema>;
```

Next: [Streaming & Events →](./09-streaming-events.md)
