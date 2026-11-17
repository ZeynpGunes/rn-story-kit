import type { DeepPartial, StoryTheme } from '../types';

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function merge(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(override)) return override;
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    out[key] = merge(base[key], override[key]);
  }
  return out;
}

/** Deep-merges override onto base. Arrays are replaced. Never mutates base. */
export function mergeTheme(
  base: StoryTheme,
  override?: DeepPartial<StoryTheme>
): StoryTheme {
  return override ? (merge(base, override) as StoryTheme) : base;
}
