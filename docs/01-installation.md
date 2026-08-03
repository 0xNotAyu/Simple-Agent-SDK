# Installation

## Requirements

- Node.js 18+
- TypeScript 5+ (the SDK is written in and ships types for TS, but plain JS consumers can use it too)

## Install

```bash
npm install ayu-agent-sdk
```

This pulls in the SDK plus its runtime dependencies:

- `zod` — schema validation for tool inputs and structured outputs
- `zod-to-json-schema` — converts zod schemas into JSON Schema for the model
- `openai` — official OpenAI client, used by `OpenAIProvider`
- `@anthropic-ai/sdk` — official Anthropic client, used by `AnthropicProvider`
- `dotenv` — loads `.env` files (optional, only if you use it in your own app)

You only need API keys for the providers you actually use.

## Environment variables

Create a `.env` file in your project root:

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

Providers read these automatically if you don't pass `apiKey` explicitly:

```ts
import { OpenAIProvider } from "ayu-agent-sdk";

const provider = new OpenAIProvider({ model: "gpt-4o-mini" }); // reads OPENAI_API_KEY
```

**Never commit your `.env` file.** Ayu never logs raw API keys and never includes them in trace output.

## From source (for this assignment / local dev)

```bash
git clone <your-repo-url>
cd ayu-agent-sdk
npm install
npm run build       # compiles src/ -> dist/, typechecks everything
npm run example:basic
```

Next: [Quick Start →](./02-quickstart.md)
