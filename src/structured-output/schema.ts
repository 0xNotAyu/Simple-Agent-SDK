import { z, type ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export interface StructuredOutputConfig<T> {
  schema: ZodType<T>;
  /** Max number of "please fix this JSON" repair attempts. Default 2. */
  maxRepairAttempts?: number;
}

export interface StructuredParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Validates raw model text against a zod schema, expecting JSON content. */
export function parseStructuredOutput<T>(
  schema: ZodType<T>,
  rawText: string
): StructuredParseResult<T> {
  let json: unknown;
  try {
    json = JSON.parse(rawText);
  } catch (err) {
    return { success: false, error: `Output is not valid JSON: ${(err as Error).message}` };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message };
  }
  return { success: true, data: parsed.data };
}

export function schemaToJsonSchema(schema: ZodType<unknown>): Record<string, unknown> {
  return zodToJsonSchema(schema, { target: "openApi3" }) as Record<string, unknown>;
}

export { z };
