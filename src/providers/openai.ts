import OpenAI from "openai";
import type { ModelProvider } from "./provider.js";
import type {
  GenerateParams,
  GenerateResult,
  StreamChunk,
  ToolCall,
} from "../core/types.js";

export interface OpenAIProviderConfig {
  apiKey?: string;
  baseURL?: string;
  model: string;
}

export class OpenAIProvider implements ModelProvider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;

  constructor(config: OpenAIProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey ?? process.env.OPENAI_API_KEY,
      baseURL: config.baseURL,
    });
    this.model = config.model;
  }

  private buildMessages(params: GenerateParams): OpenAI.Chat.ChatCompletionMessageParam[] {
    const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: params.systemPrompt },
    ];
    for (const m of params.messages) {
      if (m.role === "tool") {
        msgs.push({
          role: "tool",
          tool_call_id: m.toolCallId ?? "",
          content: m.content,
        });
      } else if (m.role === "assistant") {
        msgs.push({
          role: "assistant",
          content: m.content || null,
          tool_calls: m.toolCalls?.map((tc) => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: JSON.stringify(tc.input) },
          })),
        } as OpenAI.Chat.ChatCompletionMessageParam);
      } else {
        msgs.push({ role: "user", content: m.content });
      }
    }
    return msgs;
  }

  private buildTools(params: GenerateParams): OpenAI.Chat.ChatCompletionTool[] | undefined {
    if (!params.tools.length) return undefined;
    return params.tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: this.buildMessages(params),
      tools: this.buildTools(params),
      ...(params.responseSchema
        ? {
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "structured_output",
                strict: true,
                schema: params.responseSchema,
              },
            },
          }
        : {}),
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new Error("OpenAI returned no choices");
    }

    const toolCalls: ToolCall[] = (choice.message.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      input: safeJsonParse(tc.function.arguments),
    }));

    return {
      content: choice.message.content ?? null,
      toolCalls,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      stopReason: toolCalls.length > 0 ? "tool_call" : "end_turn",
    };
  }

  async *stream(params: GenerateParams): AsyncGenerator<StreamChunk, GenerateResult, void> {
    const streamResp = await this.client.chat.completions.create({
      model: this.model,
      messages: this.buildMessages(params),
      tools: this.buildTools(params),
      stream: true,
    });

    let fullText = "";
    const toolCallBuf: Record<number, { id: string; name: string; args: string }> = {};

    for await (const chunk of streamResp) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        fullText += delta.content;
        yield { type: "text_delta", textDelta: delta.content };
      }
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!toolCallBuf[idx]) {
            toolCallBuf[idx] = { id: tc.id ?? "", name: "", args: "" };
          }
          if (tc.id) toolCallBuf[idx].id = tc.id;
          if (tc.function?.name) toolCallBuf[idx].name += tc.function.name;
          if (tc.function?.arguments) toolCallBuf[idx].args += tc.function.arguments;
        }
      }
    }

    const toolCalls: ToolCall[] = Object.values(toolCallBuf).map((t) => ({
      id: t.id,
      name: t.name,
      input: safeJsonParse(t.args),
    }));

    for (const tc of toolCalls) {
      yield { type: "tool_call", toolCall: tc };
    }
    yield { type: "end" };

    return {
      content: fullText || null,
      toolCalls,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      stopReason: toolCalls.length > 0 ? "tool_call" : "end_turn",
    };
  }
}

function safeJsonParse(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
