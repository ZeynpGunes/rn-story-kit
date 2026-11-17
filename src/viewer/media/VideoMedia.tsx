import { Image } from 'expo-image';
import { VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useStoryContext } from '../../provider/StoryProvider';
import type { StoryItem } from '../../types';
import { useVideoSlot } from './videoSlots';

export interface VideoMediaProps {
  story: StoryItem;
  playing: boolean;
  onFirstFrame(): void;
  onBuffering(b: boolean): void;
  onDuration(ms: number): void;
  onError(): void;
}

// VideoPlayer extends expo's SharedObject; `expo` is not installed here, so
// the typings lose addListener. Declare the slice we use; it mirrors the
// `sourceLoad` and `statusChange` entries of expo-video 58's
// VideoPlayerEvents.
interface PlayerEvents {
  addListener(
    event: 'sourceLoad',
    fn: (e: { duration: number }) => void
  ): { remove(): void };
  addListener(
    event: 'statusChange',
    fn: (e: { status: string }) => void
  ): { remove(): void };
}

/** Thumbnail/thumbhash standing in for a video that is not playing. */
export function VideoThumb({ story }: { story: StoryItem }) {
  const source = story.thumbnail
    ? { uri: story.thumbnail }
    : story.thumbhash
      ? { thumbhash: story.thumbhash }
      : undefined;
  return (
    <Image
      testID="story-video-thumb"
      source={source}
      contentFit="contain"
      style={StyleSheet.absoluteFill}
    />
  );
}

/** Active story video. The thumb stays until the first frame, then fades. */
export function VideoMedia({
  story,
  playing,
  onFirstFrame,
  onBuffering,
  onDuration,
  onError,
}: VideoMediaProps) {
  const slot = useVideoSlot(story.id);
  const player = slot?.player ?? null;
  const loadedDuration = slot?.loadedDuration ?? null;
  const loadedRef = useRef(loadedDuration);
  loadedRef.current = loadedDuration;
  const fadeMs = useStoryContext().config.motion.thumbVideoCrossfadeMs;
  const [thumbShown, setThumbShown] = useState(true);
  const thumbOpacity = useSharedValue(1);
  const thumbStyle = useAnimatedStyle(() => ({ opacity: thumbOpacity.value }));

  const cb = useRef({ onFirstFrame, onBuffering, onDuration, onError });
  cb.current = { onFirstFrame, onBuffering, onDuration, onError };

  useEffect(() => {
    if (!player) return;
    // Status/duration are stale right after replace(); trust them only
    // once this source's own sourceLoad was seen by the slot.
    const known = loadedRef.current;
    let ready = known !== null && player.status === 'readyToPlay';
    if (known !== null && known > 0) cb.current.onDuration(known * 1000);
    const events = player as unknown as PlayerEvents;
    const subs = [
      events.addListener('sourceLoad', ({ duration }) =>
        cb.current.onDuration(duration * 1000)
      ),
      events.addListener('statusChange', ({ status }) => {
        if (status === 'readyToPlay') {
          ready = true;
          cb.current.onBuffering(false);
        } else if (status === 'loading' && ready) {
          cb.current.onBuffering(true);
        } else if (status === 'error') {
          cb.current.onBuffering(false);
          cb.current.onError();
        } else if (status === 'idle') {
          cb.current.onBuffering(false);
        }
      }),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [player]);

  useEffect(() => {
    if (!player) return;
    if (playing) player.play();
    else player.pause();
  }, [player, playing]);

  // The slot outlives this view; never leave it playing.
  useEffect(() => () => player?.pause(), [player]);

  const fadeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(fadeTimer.current), []);
  const handleFirstFrame = () => {
    thumbOpacity.value = withTiming(0, { duration: fadeMs });
    fadeTimer.current = setTimeout(() => setThumbShown(false), fadeMs);
    cb.current.onFirstFrame();
  };

  return (
    <>
      {player && (
        <VideoView
          testID="story-video"
          player={player}
          contentFit="contain"
          nativeControls={false}
          accessibilityLabel={story.alt}
          onFirstFrameRender={handleFirstFrame}
          style={StyleSheet.absoluteFill}
        />
      )}
      {thumbShown && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, thumbStyle]}
        >
          <VideoThumb story={story} />
        </Animated.View>
      )}
    </>
  );
}
