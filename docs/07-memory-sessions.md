# Memory & Sessions

Ayu separates three kinds of state, deliberately:

| Concept | What it is | Lifetime |
|---|---|---|
| **Agent configuration** | name, instructions, tools, provider, guardrails | Set once at `Agent.builder().build()`, immutable per instance |
| **Run state** | the in-progress turn loop, current tool calls, trace | Lives only for the duration of one `run()` call |
| **Session state** | conversation history across multiple `run()` calls | Persisted via a `SessionStore`, keyed by `sessionId` |

This separation means the same `Agent` instance can safely serve many concurrent users/sessions — nothing about a specific conversation lives on the `Agent` object itself.

## Multi-turn conversations

Pass the same `sessionId` across calls to continue a conversation:

```ts
const r1 = await agent.run("My name is Aayush.");
const r2 = await agent.run("What's my name?", { sessionId: r1.sessionId });
// r2.output references "Aayush" because history was persisted and replayed
```

If you don't pass a `sessionId`, one is generated per run (no continuity).

## Storage adapters

### InMemorySessionStore (default)

```ts
import { InMemorySessionStore } from "ayu-agent-sdk";
Agent.builder().session(new InMemorySessionStore()) /* ... */
```

Fast, zero setup, lost on process restart. Good for tests/demos.

### FileSessionStore

```ts
import { FileSessionStore } from "ayu-agent-sdk";
Agent.builder().session(new FileSessionStore("./sessions")) /* ... */
```

One JSON file per session under the given directory. Durable across restarts, good for local apps/small deployments.

### Custom adapters (SQLite, Redis, Postgres, ...)

Implement the `SessionStore` interface:

```ts
interface SessionStore {
  get(sessionId: string): Promise<SessionData | undefined>;
  save(session: SessionData): Promise<void>;
  delete(sessionId: string): Promise<void>;
  append(sessionId: string, messages: ChatMessage[]): Promise<SessionData>;
}
```

Example sketch for Redis:

```ts
class RedisSessionStore implements SessionStore {
  constructor(private redis: RedisClient) {}
  async get(id: string) {
    const raw = await this.redis.get(`session:${id}`);
    return raw ? JSON.parse(raw) : undefined;
  }
  async save(session: SessionData) {
    await this.redis.set(`session:${session.sessionId}`, JSON.stringify(session));
  }
  async delete(id: string) { await this.redis.del(`session:${id}`); }
  async append(id: string, messages: ChatMessage[]) {
    const existing = await this.get(id);
    const session = { /* merge, as in FileSessionStore */ };
    await this.save(session);
    return session;
  }
}
```

Next: [Structured Output →](./08-structured-output.md)
