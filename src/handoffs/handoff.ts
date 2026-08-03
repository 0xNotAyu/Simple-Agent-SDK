import { z } from "zod";
import { defineTool, RunnableTool } from "../tools/tool.js";

/**
 * A Handoff is a special tool that, instead of returning a result to
 * the current agent, transfers control (and context) to another agent.
 * It's built on top of the normal tool system so it shows up in the
 * model's tool list and in traces/logs like any other tool call.
 */
export interface HandoffTarget {
  agentName: string;
  reason?: string;
}

const handoffInputSchema = z.object({
  reason: z.string().describe("Why this handoff is happening"),
  contextSummary: z.string().describe("Summary of relevant context to pass to the next agent"),
});

export function createHandoffTool(targetAgentName: string): RunnableTool<unknown, unknown> {
  return defineTool({
    name: `handoff_to_${targetAgentName}`,
    description: `Transfer this conversation to the "${targetAgentName}" agent when the request is better handled by it.`,
    inputSchema: handoffInputSchema,
    async execute(input) {
      return { handoff: true, targetAgentName, ...input };
    },
  }) as unknown as RunnableTool<unknown, unknown>;
}

export class HandoffLoopGuard {
  private chain: string[] = [];
  constructor(private readonly maxChainLength = 6) {}

  visit(agentName: string): { ok: boolean; chain: string[] } {
    this.chain.push(agentName);
    const seen = new Set<string>();
    let loop = false;
    for (const name of this.chain) {
      if (seen.has(name)) {
        loop = true;
        break;
      }
      seen.add(name);
    }
    const tooLong = this.chain.length > this.maxChainLength;
    return { ok: !loop && !tooLong, chain: [...this.chain] };
  }

  getChain(): string[] {
    return [...this.chain];
  }
}
