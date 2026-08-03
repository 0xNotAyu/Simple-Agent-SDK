# Model Providers

Ayu never talks to a specific LLM SDK from inside the agent loop. Instead, every model call goes through the `ModelProvider` interface:

```ts
interface ModelProvider {
  readonly name: string;
  generate(params: GenerateParams): Promise<GenerateResult>;
  stream?(params: GenerateParams): AsyncGenerator<StreamChunk, GenerateResult, void>;
}
```

This means:
- Swapping providers is a one-line change (`.model(new AnthropicProvider(...))` instead of `.model(new OpenAIProvider(...))`)
- You can build your own provider for any model API by implementing this interface
- Fallback chains are trivial (see below)

## Built-in providers

### OpenAIProvider

```ts
import { OpenAIProvider } from "ayu-agent-sdk";

const provider = new OpenAIProvider({
  model: "gpt-4o-mini",
  apiKey: process.env.OPENAI_API_KEY,   // optional, defaults to env var
  baseURL: undefined,                    // optional, for OpenAI-compatible endpoints
});
```

Supports native function calling, JSON-schema structured output, and token streaming.

### AnthropicProvider

```ts
import { AnthropicProvider } from "ayu-agent-sdk";

const provider = new AnthropicProvider({
  model: "claude-sonnet-4-20250514",
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxTokens: 1024,
});
```

Supports native tool use.

### FallbackProvider

Tries providers in order, falling through on error (rate limits, outages, auth issues):

```ts
import { FallbackProvider, OpenAIProvider, AnthropicProvider } from "ayu-agent-sdk";

const provider = new FallbackProvider([
  new OpenAIProvider({ model: "gpt-4o-mini" }),
  new AnthropicProvider({ model: "claude-sonnet-4-20250514" }),
]);

const agent = Agent.builder().model(provider) /* ... */.build();
```

## Writing your own provider

Implement `generate()` (required) and optionally `stream()`:

```ts
import type { ModelProvider, GenerateParams, GenerateResult } from "ayu-agent-sdk";

class MyProvider implements ModelProvider {
  readonly name = "my-provider";

  async generate(params: GenerateParams): Promise<GenerateResult> {
    // call your model API, translate params.messages / params.tools
    // into its request format, and translate the response back into
    // { content, toolCalls, usage, stopReason }
  }
}
```

See `src/providers/openai.ts` and `src/providers/anthropic.ts` in the source for full reference implementations, including tool-call translation and streaming.

Next: [Tools →](./04-tools.md)
