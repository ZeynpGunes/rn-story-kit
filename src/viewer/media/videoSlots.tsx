import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform, StyleSheet } from 'react-native';
import type { StoryItem } from '../../types';

/** Hard cap on live players: the active story plus one preloaded video. */
const SLOT_COUNT = 2;

export interface VideoSlot {
  player: VideoPlayer;
  /**
   * Duration in seconds, set from this slot's own sourceLoad for the
   * current source; null until then. Player status/duration are stale
   * right after replace(), so only this value is trustworthy.
   */
  loadedDuration: number | null;
}

const styles = StyleSheet.create({
  preload: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});

const SlotsContext = createContext<ReadonlyMap<string, VideoSlot>>(new Map());

/** Slot holding the source of story `id`, or null until it is assigned. */
export function useVideoSlot(id: string): VideoSlot | null {
  return useContext(SlotsContext).get(id) ?? null;
}

// Same slice of expo-video 58's event map that VideoMedia uses.
interface SourceLoadEvents {
  addListener(
    event: 'sourceLoad',
    fn: (e: { duration: number }) => void
  ): { remove(): void };
}

export interface VideoSlotsProviderProps {
  active: StoryItem | undefined;
  /** Next video to preload, if any. */
  next: StoryItem | undefined;
  /** Mute both players. Default false. */
  muted?: boolean;
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
  muted = false,
  children,
}: VideoSlotsProviderProps) {
  // Fixed hook count: the cap is structural.
  const slotA = useVideoPlayer(null);
  const slotB = useVideoPlayer(null);
  const players = useMemo(() => [slotA, slotB], [slotA, slotB]);

  useEffect(() => {
    players.forEach((player) => {
      player.muted = muted;
    });
  }, [players, muted]);

  const assigned = useRef<(StoryItem | null)[]>(
    Array<StoryItem | null>(SLOT_COUNT).fill(null)
  );
  const loaded = useRef<(string | null)[]>(
    Array<string | null>(SLOT_COUNT).fill(null)
  );
  const durations = useRef<(number | null)[]>(
    Array<number | null>(SLOT_COUNT).fill(null)
  );
  const [loadedKey, setLoadedKey] = useState('');
  const publish = () =>
    setLoadedKey(
      loaded.current.map((id, i) => `${id}:${durations.current[i]}`).join('|')
    );

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
      durations.current[i] = null;
      const player = players[i];
      if (!player) return;
      // Freed or reassigned: never keep playing the previous story.
      player.pause();
      if (s) {
        player.replace(s.uri);
        player.pause();
      } else {
        player.replace(null);
      }
    });
    publish();
  }, [assignedKey, players]);

  useEffect(() => {
    const subs = players.map((player, i) =>
      (player as unknown as SourceLoadEvents).addListener(
        'sourceLoad',
        ({ duration }) => {
          if (!loaded.current[i]) return;
          durations.current[i] = duration;
          publish();
        }
      )
    );
    return () => subs.forEach((sub) => sub.remove());
  }, [players]);

  const map = useMemo(() => {
    const m = new Map<string, VideoSlot>();
    loaded.current.forEach((id, i) => {
      const player = players[i];
      if (id && player) {
        m.set(id, { player, loadedDuration: durations.current[i] ?? null });
      }
    });
    return m;
    // loadedKey changes whenever loaded.current does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedKey, players]);

  // A player preloaded with no VideoView decodes against expo-video's
  // placeholder surface; once the page's VideoView takes it over, Android
  // plays on with a black picture (first frame and playback both report
  // fine). Parking it on a hidden 1x1 view keeps a real surface from the
  // start; the page's view then takes over from that. Seen on Android only,
  // so iOS keeps a single view per player.
  const preloading =
    Platform.OS === 'android'
      ? kept.flatMap((s, i) =>
          s && s.id !== active?.id && players[i]
            ? [{ i, player: players[i] }]
            : []
        )
      : [];

  return (
    <SlotsContext.Provider value={map}>
      {children}
      {preloading.map(({ i, player }) => (
        <VideoView
          key={i}
          testID="story-video-preload"
          player={player}
          nativeControls={false}
          pointerEvents="none"
          style={styles.preload}
        />
      ))}
    </SlotsContext.Provider>
  );
}
