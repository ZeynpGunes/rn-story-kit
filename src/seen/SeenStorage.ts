/** Pluggable persistence for seen story ids. Sync or async. */
export interface SeenStorage {
  getAll(): string[] | Promise<string[]>;
  add(ids: string[]): void | Promise<void>;
  clear?(): void | Promise<void>;
}
