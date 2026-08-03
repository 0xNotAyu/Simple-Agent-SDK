# Guardrails

Guardrails validate or transform content at three points in the loop: **input** (before the model sees the user's message), **output** (before the final answer reaches the caller), and **tool** (before a tool call executes).

## Configuring guardrails

```ts
import { Agent, maxLengthGuardrail, bannedWordsGuardrail, piiRedactionGuardrail, dangerousToolGuardrail } from "ayu-agent-sdk";

const agent = Agent.builder()
  // ...
  .guardrails({
    input: [maxLengthGuardrail(4000), bannedWordsGuardrail(["ignore previous instructions"])],
    output: [piiRedactionGuardrail()],
    tool: [dangerousToolGuardrail(["deleteFile", "sendMoney"])],
    requireApprovalFor: ["deleteFile"],
    onApprovalRequired: async (toolName, input) => confirmWithUser(toolName, input),
  })
  .build();
```

If any input or tool guardrail fails, the SDK throws `GuardrailBlockedError` (input) or feeds a blocked message back to the model (tool) rather than executing. Output guardrails can either **block** the response or **rewrite** it (e.g. redact PII) before returning.

## Built-in guardrails

| Guardrail | Stage | What it does |
|---|---|---|
| `maxLengthGuardrail(maxChars)` | input | Rejects input over a length limit |
| `bannedWordsGuardrail(words[])` | input | Rejects input containing banned substrings |
| `piiRedactionGuardrail()` | output | Redacts emails/phone numbers, doesn't block |
| `dangerousToolGuardrail(names[])` | tool | Hard-blocks specific tool names |

## Writing a custom guardrail

A guardrail is just a function returning `{ pass, reason?, modifiedContent? }`:

```ts
import type { InputGuardrail } from "ayu-agent-sdk";

const noSqlInjection: InputGuardrail = (input) => {
  if (/;\s*(drop|delete)\s+table/i.test(input)) {
    return { pass: false, reason: "Detected possible SQL injection pattern" };
  }
  return { pass: true };
};
```

Output guardrails work the same way but can rewrite content:

```ts
const output: OutputGuardrail = (text) => ({
  pass: true,
  modifiedContent: text.replace(/secretKey_\w+/g, "[REDACTED]"),
});
```

## Approval flow for risky tool calls

Set `requiresApproval: true` on a tool definition, or list its name in `requireApprovalFor`. When triggered, the SDK emits an `approval_required` event and calls `onApprovalRequired(toolName, input)`, waiting for a boolean. Returning `false` (or not providing the callback) denies the call and feeds that back to the model — it doesn't crash the run.

Next: [Memory & Sessions →](./07-memory-sessions.md)
