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
// the typings lose addListener. Declare the slice we use.
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
  const player = useVideoSlot(story.id);
  const fadeMs = useStoryContext().config.motion.thumbVideoCrossfadeMs;
  const [thumbShown, setThumbShown] = useState(true);
  const thumbOpacity = useSharedValue(1);
  const thumbStyle = useAnimatedStyle(() => ({ opacity: thumbOpacity.value }));

  const cb = useRef({ onFirstFrame, onBuffering, onDuration, onError });
  cb.current = { onFirstFrame, onBuffering, onDuration, onError };

  useEffect(() => {
    if (!player) return;
    let ready = player.status === 'readyToPlay';
    if (ready && player.duration > 0) {
      cb.current.onDuration(player.duration * 1000);
    }
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
          cb.current.onError();
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
