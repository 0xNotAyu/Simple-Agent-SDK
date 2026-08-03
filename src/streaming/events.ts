import { EventEmitter } from "events";

export interface AgentEventMap {
  text_delta: { text: string };
  tool_started: { toolName: string; input: unknown; toolCallId: string };
  tool_completed: { toolName: string; output: unknown; toolCallId: string; durationMs: number };
  tool_failed: { toolName: string; error: string; toolCallId: string };
  handoff_started: { fromAgent: string; toAgent: string; reason?: string };
  guardrail_triggered: { stage: "input" | "output" | "tool"; reason: string };
  approval_required: { toolName: string; input: unknown };
  run_completed: { output: string; turns: number };
  run_failed: { error: string };
  turn_started: { turn: number };
}

export type AgentEventName = keyof AgentEventMap;

export type StreamEvent =
  | ({ type: "text_delta" } & AgentEventMap["text_delta"])
  | ({ type: "turn_started" } & AgentEventMap["turn_started"])
  | ({ type: "tool_started" } & AgentEventMap["tool_started"])
  | ({ type: "tool_completed" } & AgentEventMap["tool_completed"])
  | ({ type: "tool_failed" } & AgentEventMap["tool_failed"])
  | ({ type: "handoff_started" } & AgentEventMap["handoff_started"])
  | ({ type: "guardrail_triggered" } & AgentEventMap["guardrail_triggered"])
  | ({ type: "approval_required" } & AgentEventMap["approval_required"]);

/**
 * Typed wrapper around Node's EventEmitter so consumers get
 * autocomplete + type checking on event payloads.
 */
export class AgentEventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  on<K extends AgentEventName>(event: K, listener: (payload: AgentEventMap[K]) => void): void {
    this.emitter.on(event, listener);
  }

  off<K extends AgentEventName>(event: K, listener: (payload: AgentEventMap[K]) => void): void {
    this.emitter.off(event, listener);
  }

  emit<K extends AgentEventName>(event: K, payload: AgentEventMap[K]): void {
    this.emitter.emit(event, payload);
  }

  /** Async iterator over a single event type -- handy for `for await` consumption. */
  async *iterate<K extends AgentEventName>(event: K): AsyncGenerator<AgentEventMap[K]> {
    const queue: AgentEventMap[K][] = [];
    let resolve: (() => void) | null = null;

    const handler = (payload: AgentEventMap[K]) => {
      queue.push(payload);
      if (resolve) {
        resolve();
        resolve = null;
      }
    };
    this.on(event, handler);

    try {
      while (true) {
        if (queue.length === 0) {
          await new Promise<void>((r) => (resolve = r));
        }
        const next = queue.shift();
        if (next) yield next;
      }
    } finally {
      this.off(event, handler);
    }
  }
}
