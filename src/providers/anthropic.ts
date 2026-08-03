import Anthropic from "@anthropic-ai/sdk";
import type { ModelProvider } from "./provider.js";
import type { GenerateParams, GenerateResult, ToolCall } from "../core/types.js";

export interface AnthropicProviderConfig {
  apiKey?: string;
  baseURL?: string;
  model: string;
  maxTokens?: number;
}

export class AnthropicProvider implements ModelProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(config: AnthropicProviderConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY,
      baseURL: config.baseURL,
    });
    this.model = config.model;
    this.maxTokens = config.maxTokens ?? 1024;
  }

  private buildMessages(params: GenerateParams): Anthropic.MessageParam[] {
    const msgs: Anthropic.MessageParam[] = [];
    for (const m of params.messages) {
      if (m.role === "tool") {
        msgs.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: m.toolCallId ?? "",
              content: m.content,
            },
          ],
        });
      } else if (m.role === "assistant") {
        const blocks: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam> = [];
        if (m.content) blocks.push({ type: "text", text: m.content });
        for (const tc of m.toolCalls ?? []) {
          blocks.push({
            type: "tool_use",
            id: tc.id,
            name: tc.name,
            input: tc.input as Record<string, unknown>,
          });
        }
        msgs.push({ role: "assistant", content: blocks });
      } else if (m.role === "user") {
        msgs.push({ role: "user", content: m.content });
      }
    }
    return msgs;
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: params.systemPrompt,
      messages: this.buildMessages(params),
      tools: params.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as Anthropic.Tool.InputSchema,
      })),
    });

    let content: string | null = null;
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        content = (content ?? "") + block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({ id: block.id, name: block.name, input: block.input });
      }
    }

    return {
      content,
      toolCalls,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      stopReason: toolCalls.length > 0 ? "tool_call" : "end_turn",
    };
  }
}