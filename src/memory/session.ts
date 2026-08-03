import { promises as fs } from "fs";
import path from "path";
import type { ChatMessage } from "../core/types.js";

export interface SessionData {
  sessionId: string;
  history: ChatMessage[];
  metadata: Record<string, unknown>;
  updatedAt: string;
}

/**
 * SessionStore is the storage abstraction for persistent, multi-turn
 * conversation state. Implementations can be in-memory, file-based,
 * SQLite, Redis, etc -- the agent runtime only depends on this interface.
 */
export interface SessionStore {
  get(sessionId: string): Promise<SessionData | undefined>;
  save(session: SessionData): Promise<void>;
  delete(sessionId: string): Promise<void>;
  append(sessionId: string, messages: ChatMessage[]): Promise<SessionData>;
}

export class InMemorySessionStore implements SessionStore {
  private store = new Map<string, SessionData>();

  async get(sessionId: string): Promise<SessionData | undefined> {
    return this.store.get(sessionId);
  }

  async save(session: SessionData): Promise<void> {
    this.store.set(session.sessionId, session);
  }

  async delete(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
  }

  async append(sessionId: string, messages: ChatMessage[]): Promise<SessionData> {
    const existing = this.store.get(sessionId);
    const session: SessionData = existing
      ? { ...existing, history: [...existing.history, ...messages], updatedAt: new Date().toISOString() }
      : {
          sessionId,
          history: messages,
          metadata: {},
          updatedAt: new Date().toISOString(),
        };
    this.store.set(sessionId, session);
    return session;
  }
}

/**
 * Simple durable adapter: one JSON file per session directory.
 * Good enough for local dev / small deployments; swap for the
 * SQLite/Redis adapter in production by implementing SessionStore.
 */
export class FileSessionStore implements SessionStore {
  constructor(private readonly dir: string) {}

  private filePath(sessionId: string) {
    // sanitize to avoid path traversal from a user-controlled sessionId
    const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(this.dir, `${safeId}.json`);
  }

  private async ensureDir() {
    await fs.mkdir(this.dir, { recursive: true });
  }

  async get(sessionId: string): Promise<SessionData | undefined> {
    try {
      const raw = await fs.readFile(this.filePath(sessionId), "utf-8");
      return JSON.parse(raw) as SessionData;
    } catch {
      return undefined;
    }
  }

  async save(session: SessionData): Promise<void> {
    await this.ensureDir();
    await fs.writeFile(this.filePath(session.sessionId), JSON.stringify(session, null, 2));
  }

  async delete(sessionId: string): Promise<void> {
    try {
      await fs.unlink(this.filePath(sessionId));
    } catch {
      // already gone -- fine
    }
  }

  async append(sessionId: string, messages: ChatMessage[]): Promise<SessionData> {
    const existing = await this.get(sessionId);
    const session: SessionData = existing
      ? { ...existing, history: [...existing.history, ...messages], updatedAt: new Date().toISOString() }
      : {
          sessionId,
          history: messages,
          metadata: {},
          updatedAt: new Date().toISOString(),
        };
    await this.save(session);
    return session;
  }
}
