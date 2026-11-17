import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  GestureDetector,
  useExclusiveGestures,
  useLongPressGesture,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useAnimatedReaction,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { tapNext, tapPrev, type NavResult } from '../model/navigation';
import { useStoryContext } from '../provider/StoryProvider';
import { useStoryTheme } from '../theme/StoryThemeProvider';
import type { StoryItem, StoryUser } from '../types';
import { LoadingIndicator } from './LoadingIndicator';
import { ImageMedia } from './media/ImageMedia';
import { MediaBackground } from './media/MediaBackground';
import { VideoMedia, VideoThumb } from './media/VideoMedia';
import { ProgressBar } from './ProgressBar';
import { useStoryTimer } from './useStoryTimer';

export interface UserPageProps {
  user: StoryUser;
  storyIndex: number;
  /** Ordered users of this viewer session, for navigation results. */
  users: StoryUser[];
  /** userId -> last viewed story index, for previous-user taps. */
  lastViewed: Record<string, number>;
  isActive: boolean;
  held: SharedValue<boolean>;
  onNav(r: NavResult): void;
  onMediaFirstFrame(story: StoryItem): void;
  /** Chrome (scrim, header) drawn over the media; hidden while pressing. */
  children?: ReactNode;
}

/** One user's page. Remounts per story so timer and media state reset. */
export function UserPage(props: UserPageProps) {
  const story = props.user.stories[props.storyIndex];
  if (!story) return null;
  return <StoryPage key={story.id} story={story} {...props} />;
}

function StoryPage({
  story,
  user,
  storyIndex,
  users,
  lastViewed,
  isActive,
  held,
  onNav,
  onMediaFirstFrame,
  children,
}: UserPageProps & { story: StoryItem }) {
  const { config } = useStoryContext();
  const { motion } = config;
  const { loading } = useStoryTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  // UI-thread mirrors so pausing never waits for a React render.
  const pressed = useSharedValue(false);
  const mediaBlocked = useSharedValue(true);
  const buffering = useSharedValue(false);
  // Playback hold; the timer additionally waits for media (mediaBlocked).
  const playHeld = useDerivedValue(
    () => held.value || pressed.value || buffering.value
  );
  const timerHeld = useDerivedValue(() => playHeld.value || mediaBlocked.value);
  const [playbackHeld, setPlaybackHeld] = useState(false);
  useAnimatedReaction(
    () => playHeld.value,
    (h, prev) => {
      if (h !== prev) scheduleOnRN(setPlaybackHeld, h);
    }
  );
  const [videoMs, setVideoMs] = useState<number | null>(null);

  const navState = {
    userIndex: users.findIndex((u) => u.id === user.id),
    storyIndex,
  };
  const navRef = useRef({ onNav, navState, users, lastViewed });
  navRef.current = { onNav, navState, users, lastViewed };

  const goNext = useCallback(() => {
    const c = navRef.current;
    c.onNav(tapNext(c.navState, c.users));
  }, []);

  const { progress } = useStoryTimer({
    durationMs:
      story.durationMs ??
      (story.type === 'video' ? videoMs : null) ??
      config.imageDurationMs,
    active: isActive,
    held: timerHeld,
    onComplete: goNext,
  });

  // A video needs its duration and a rendered first frame before it runs.
  const durationKnown = story.durationMs !== undefined || videoMs !== null;
  useEffect(() => {
    if (story.type === 'video' && ready && durationKnown && !failed) {
      mediaBlocked.value = false;
    }
  }, [story.type, ready, durationKnown, failed, mediaBlocked]);

  // Seen rule: the active story's first frame; previews never mark.
  const marked = useRef(false);
  useEffect(() => {
    if (isActive && ready && !marked.current) {
      marked.current = true;
      onMediaFirstFrame(story);
    }
  }, [isActive, ready, onMediaFirstFrame, story]);

  useEffect(() => {
    if (!isActive || !failed) return;
    const t = setTimeout(goNext, config.mediaErrorAdvanceMs);
    return () => clearTimeout(t);
  }, [isActive, failed, goNext, config.mediaErrorAdvanceMs]);

  useEffect(() => {
    if (!isActive || ready || failed) {
      setShowLoading(false);
      return;
    }
    const t = setTimeout(() => setShowLoading(true), loading.showAfterMs);
    return () => clearTimeout(t);
  }, [isActive, ready, failed, loading.showAfterMs]);

  const handleTapAt = useCallback(
    (x: number) => {
      const c = navRef.current;
      c.onNav(
        x < width * config.tapZoneRatio
          ? tapPrev(c.navState, c.users, c.lastViewed)
          : tapNext(c.navState, c.users)
      );
    },
    [width, config.tapZoneRatio]
  );

  const uiOpacity = useSharedValue(1);
  const hideMs = reduced ? motion.reducedUiFadeMs : motion.uiHideMs;
  const showMs = reduced ? motion.reducedUiFadeMs : motion.uiShowMs;

  const longPress = useLongPressGesture({
    testID: 'story-long-press',
    minDuration: motion.longPressMs,
    maxDistance: motion.longPressMaxDistance,
    onActivate: () => {
      'worklet';
      pressed.value = true;
      cancelAnimation(progress);
      uiOpacity.value = withTiming(0, {
        duration: hideMs,
        easing: Easing.out(Easing.cubic),
      });
      scheduleOnRN(setUiHidden, true);
    },
    onFinalize: () => {
      'worklet';
      if (!pressed.value) return;
      pressed.value = false;
      uiOpacity.value = withTiming(1, {
        duration: showMs,
        easing: Easing.out(Easing.cubic),
      });
      scheduleOnRN(setUiHidden, false);
    },
  });
  const tap = useTapGesture({
    testID: 'story-tap',
    maxDuration: motion.tapMaxDurationMs,
    maxDistance: motion.tapMaxDistance,
    onActivate: (e) => {
      'worklet';
      scheduleOnRN(handleTapAt, e.x);
    },
  });
  const gesture = useExclusiveGestures(longPress, tap);
  const uiStyle = useAnimatedStyle(() => ({ opacity: uiOpacity.value }));

  return (
    <View style={styles.fill}>
      <GestureDetector gesture={gesture}>
        <Animated.View testID="story-tap-area" style={styles.fill}>
          <MediaBackground story={story} />
          {story.type === 'image' && !failed && (
            <ImageMedia
              story={story}
              transitionMs={motion.thumbCrossfadeMs}
              onDisplay={() => {
                setReady(true);
                mediaBlocked.value = false;
              }}
              onError={() => {
                setFailed(true);
                mediaBlocked.value = true;
              }}
            />
          )}
          {story.type === 'video' &&
            !failed &&
            (isActive ? (
              <VideoMedia
                story={story}
                playing={!playbackHeld}
                onFirstFrame={() => setReady(true)}
                onBuffering={(b) => {
                  buffering.value = b;
                }}
                onDuration={(ms) => setVideoMs(ms)}
                onError={() => {
                  setFailed(true);
                  mediaBlocked.value = true;
                }}
              />
            ) : (
              <VideoThumb story={story} />
            ))}
          {showLoading && <LoadingIndicator />}
        </Animated.View>
      </GestureDetector>
      <Animated.View
        testID="story-ui"
        pointerEvents={uiHidden ? 'none' : 'box-none'}
        style={[StyleSheet.absoluteFill, uiStyle]}
      >
        {children}
        <ProgressBar
          count={user.stories.length}
          index={storyIndex}
          progress={progress}
          safeAreaTop={insets.top}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
