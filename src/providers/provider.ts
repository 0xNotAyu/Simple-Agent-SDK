import type { GenerateParams, GenerateResult, StreamChunk } from "../core/types.js";

/**
 * ModelProvider is the abstraction every LLM backend must implement.
 * The agent runtime never talks to OpenAI/Anthropic/etc directly --
 * it only ever talks through this interface, so swapping providers
 * (or adding fallback chains) never touches core agent logic.
 */
export interface ModelProvider {
  readonly name: string;

  generate(params: GenerateParams): Promise<GenerateResult>;

  /** Optional: providers that support token streaming implement this. */
  stream?(params: GenerateParams): AsyncGenerator<StreamChunk, GenerateResult, void>;
}

/**
 * Wraps a list of providers and tries them in order, falling through
 * to the next provider if one throws (e.g. rate limit, outage, auth error).
 */
export class FallbackProvider implements ModelProvider {
  readonly name: string;
  constructor(private readonly providers: ModelProvider[]) {
    if (providers.length === 0) {
      throw new Error("FallbackProvider requires at least one provider");
    }
    this.name = `fallback(${providers.map((p) => p.name).join(",")})`;
  }

  async generate(params: GenerateParams) {
    let lastError: unknown;
    for (const provider of this.providers) {
      try {
        return await provider.generate(params);
      } catch (err) {
        lastError = err;
        continue;
      }
    }
    throw new Error(
      `All providers failed. Last error: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`
    );
  }
}
