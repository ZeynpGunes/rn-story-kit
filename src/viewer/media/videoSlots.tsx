import { useVideoPlayer, type VideoPlayer } from 'expo-video';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { StoryItem } from '../../types';

/** Hard cap on live players: the active story plus one preloaded video. */
const SLOT_COUNT = 2;

const SlotsContext = createContext<ReadonlyMap<string, VideoPlayer>>(new Map());

/** Player holding the source of story `id`, or null until it is loaded. */
export function useVideoSlot(id: string): VideoPlayer | null {
  return useContext(SlotsContext).get(id) ?? null;
}

export interface VideoSlotsProviderProps {
  active: StoryItem | undefined;
  /** Next video to preload, if any. */
  next: StoryItem | undefined;
  children?: ReactNode;
}

/**
 * Owns the only two video players of a viewer. Stories are assigned to a
 * slot, a slot keeps its story while it stays wanted, so a preloaded
 * player becomes the active one without a reload.
 */
export function VideoSlotsProvider({
  active,
  next,
  children,
}: VideoSlotsProviderProps) {
  // Fixed hook count: the cap is structural.
  const slotA = useVideoPlayer(null);
  const slotB = useVideoPlayer(null);
  const players = useMemo(() => [slotA, slotB], [slotA, slotB]);

  const assigned = useRef<(StoryItem | null)[]>(
    Array<StoryItem | null>(SLOT_COUNT).fill(null)
  );
  const loaded = useRef<(string | null)[]>(
    Array<string | null>(SLOT_COUNT).fill(null)
  );
  const [loadedKey, setLoadedKey] = useState('');

  const wanted = [active, next].filter(
    (s): s is StoryItem => s?.type === 'video'
  );
  const kept = assigned.current.map((s) =>
    s && wanted.some((w) => w.id === s.id) ? s : null
  );
  for (const w of wanted) {
    if (kept.some((s) => s?.id === w.id)) continue;
    const free = kept.indexOf(null);
    if (free !== -1) kept[free] = w;
  }
  assigned.current = kept;
  const assignedKey = kept.map((s) => s?.id ?? '').join('|');

  useEffect(() => {
    assigned.current.forEach((s, i) => {
      const id = s?.id ?? null;
      if (id === loaded.current[i]) return;
      loaded.current[i] = id;
      const player = players[i];
      if (!player || !s) return;
      player.replace(s.uri);
      player.pause();
    });
    setLoadedKey(loaded.current.join('|'));
  }, [assignedKey, players]);

  const map = useMemo(() => {
    const m = new Map<string, VideoPlayer>();
    loaded.current.forEach((id, i) => {
      const player = players[i];
      if (id && player) m.set(id, player);
    });
    return m;
    // loadedKey changes whenever loaded.current does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedKey, players]);

  return <SlotsContext.Provider value={map}>{children}</SlotsContext.Provider>;
}
