export interface GuardrailResult {
  pass: boolean;
  reason?: string;
  /** Optionally rewrite the content instead of hard-blocking (e.g. redact PII). */
  modifiedContent?: string;
}

export type InputGuardrail = (input: string) => Promise<GuardrailResult> | GuardrailResult;
export type OutputGuardrail = (output: string) => Promise<GuardrailResult> | GuardrailResult;
export type ToolGuardrail = (
  toolName: string,
  input: unknown
) => Promise<GuardrailResult> | GuardrailResult;

export interface GuardrailConfig {
  input?: InputGuardrail[];
  output?: OutputGuardrail[];
  tool?: ToolGuardrail[];
  /** Tool names that require explicit approval before execution. */
  requireApprovalFor?: string[];
  /** Called when a tool needs approval; return true to allow, false to deny. */
  onApprovalRequired?: (toolName: string, input: unknown) => Promise<boolean> | boolean;
}

// ---- Built-in convenience guardrails -------------------------------------

/** Blocks input over a max length -- cheap defense against prompt-stuffing. */
export function maxLengthGuardrail(maxChars: number): InputGuardrail {
  return (input) => {
    if (input.length > maxChars) {
      return { pass: false, reason: `Input exceeds max length of ${maxChars} chars` };
    }
    return { pass: true };
  };
}

/** Blocks input/output containing any of the given banned substrings (case-insensitive). */
export function bannedWordsGuardrail(words: string[]): InputGuardrail {
  return (input) => {
    const lower = input.toLowerCase();
    const hit = words.find((w) => lower.includes(w.toLowerCase()));
    if (hit) {
      return { pass: false, reason: `Input contains banned term: "${hit}"` };
    }
    return { pass: true };
  };
}

/** Redacts common PII patterns (emails, phone-like numbers) from output. */
export function piiRedactionGuardrail(): OutputGuardrail {
  return (output) => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const phoneRegex = /\b\d{10}\b|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g;
    const redacted = output.replace(emailRegex, "[REDACTED_EMAIL]").replace(phoneRegex, "[REDACTED_PHONE]");
    if (redacted !== output) {
      return { pass: true, modifiedContent: redacted };
    }
    return { pass: true };
  };
}

/** Blocks a fixed list of dangerous tool names outright (defense in depth). */
export function dangerousToolGuardrail(blockedTools: string[]): ToolGuardrail {
  return (toolName) => {
    if (blockedTools.includes(toolName)) {
      return { pass: false, reason: `Tool "${toolName}" is blocked by policy` };
    }
    return { pass: true };
  };
}

export async function runInputGuardrails(
  guardrails: InputGuardrail[] | undefined,
  input: string
): Promise<GuardrailResult> {
  for (const g of guardrails ?? []) {
    const result = await g(input);
    if (!result.pass) return result;
  }
  return { pass: true };
}

export async function runOutputGuardrails(
  guardrails: OutputGuardrail[] | undefined,
  output: string
): Promise<{ result: GuardrailResult; finalContent: string }> {
  let content = output;
  for (const g of guardrails ?? []) {
    const result = await g(content);
    if (!result.pass) return { result, finalContent: content };
    if (result.modifiedContent) content = result.modifiedContent;
  }
  return { result: { pass: true }, finalContent: content };
}

export async function runToolGuardrails(
  guardrails: ToolGuardrail[] | undefined,
  toolName: string,
  input: unknown
): Promise<GuardrailResult> {
  for (const g of guardrails ?? []) {
    const result = await g(toolName, input);
    if (!result.pass) return result;
  }
  return { pass: true };
}
