import type { Rect } from '../types';

export interface RectRegistry {
  register(userId: string, measure: () => Promise<Rect | null>): () => void;
  measure(userId: string): Promise<Rect | null>;
}

export function createRectRegistry(): RectRegistry {
  const measures = new Map<string, () => Promise<Rect | null>>();
  return {
    register(userId, measure) {
      measures.set(userId, measure);
      return () => {
        if (measures.get(userId) === measure) measures.delete(userId);
      };
    },
    async measure(userId) {
      return (await measures.get(userId)?.()) ?? null;
    },
  };
}

/** Measure a bubble, giving up (null) after timeoutMs. */
export async function measureWithTimeout(
  registry: RectRegistry,
  userId: string,
  timeoutMs: number
): Promise<Rect | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(resolve, timeoutMs, null);
  });
  const rect = await Promise.race([registry.measure(userId), timeout]).catch(
    () => null
  );
  clearTimeout(timer);
  return rect;
}
