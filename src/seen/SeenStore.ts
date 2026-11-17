import type { StoryItem } from '../types';
import type { SeenStorage } from './SeenStorage';

export interface SeenStoreOptions {
  storage?: SeenStorage;
  initialSeen?: string[];
  onSeen?: (storyId: string, userId: string) => void;
}

/**
 * In-memory set of seen story ids, optionally mirrored to a SeenStorage.
 * The in-memory set is authoritative: storage errors are swallowed.
 * onSeen fires at most once per story id per store lifetime, and never for
 * ids already in initialSeen or hydrated from storage. A story with
 * `seen: true` that is not in the set is shown as seen, but the first
 * markSeen still adds it and fires onSeen.
 */
export class SeenStore {
  private ids: Set<string>;
  private listeners = new Set<() => void>();
  private version = 0;
  private storage?: SeenStorage;
  private onSeen?: SeenStoreOptions['onSeen'];

  constructor(o: SeenStoreOptions = {}) {
    this.storage = o.storage;
    this.onSeen = o.onSeen;
    this.ids = new Set(o.initialSeen ?? []);
  }

  async hydrate(): Promise<void> {
    if (!this.storage) return;
    try {
      const stored = await this.storage.getAll();
      const before = this.ids.size;
      stored.forEach((id) => this.ids.add(id));
      if (this.ids.size !== before) this.bump();
    } catch {
      // keep in-memory state
    }
  }

  isSeen(story: StoryItem): boolean {
    return this.ids.has(story.id) || story.seen === true;
  }

  markSeen(storyId: string, userId: string): boolean {
    if (this.ids.has(storyId)) return false;
    this.ids.add(storyId);
    this.persist(storyId);
    this.bump();
    this.onSeen?.(storyId, userId);
    return true;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  getVersion(): number {
    return this.version;
  }

  private persist(id: string) {
    if (!this.storage) return;
    try {
      Promise.resolve(this.storage.add([id])).catch(() => undefined);
    } catch {
      // keep in-memory state
    }
  }

  private bump() {
    this.version += 1;
    this.listeners.forEach((fn) => fn());
  }
}
