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
