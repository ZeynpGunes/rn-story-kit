import type { SeenStorage } from './SeenStorage';

const DEFAULT_KEY = 'rn-story-kit:seen';

function parseIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

function union(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b]));
}

export function createMemorySeenStorage(): SeenStorage {
  let ids = new Set<string>();
  return {
    getAll: () => Array.from(ids),
    add: (more) => {
      more.forEach((id) => ids.add(id));
    },
    clear: () => {
      ids = new Set();
    },
  };
}

/** Takes an injected MMKV-like instance; this package does not depend on MMKV. */
export function createMMKVSeenStorage(
  mmkv: {
    getString(k: string): string | undefined;
    set(k: string, v: string): void;
  },
  key: string = DEFAULT_KEY
): SeenStorage {
  const read = () => parseIds(mmkv.getString(key));
  return {
    getAll: read,
    add: (ids) => mmkv.set(key, JSON.stringify(union(read(), ids))),
    clear: () => mmkv.set(key, '[]'),
  };
}

/** Takes an injected AsyncStorage-like instance; this package does not depend on it. */
export function createAsyncStorageSeenStorage(
  as: {
    getItem(k: string): Promise<string | null>;
    setItem(k: string, v: string): Promise<void>;
  },
  key: string = DEFAULT_KEY
): SeenStorage {
  const read = async () => parseIds(await as.getItem(key));
  // Serialise writes so concurrent adds do not lose ids.
  let queue: Promise<void> = Promise.resolve();
  return {
    getAll: read,
    add: (ids) => {
      const run = queue.then(async () =>
        as.setItem(key, JSON.stringify(union(await read(), ids)))
      );
      queue = run.catch(() => undefined);
      return run;
    },
    clear: () => as.setItem(key, '[]'),
  };
}
