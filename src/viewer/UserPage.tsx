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
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { tapNext, tapPrev, type NavResult } from '../model/navigation';
import { useStoryContext } from '../provider/StoryProvider';
import type { StoryItem, StoryUser } from '../types';
import { LoadingIndicator } from './LoadingIndicator';
import { ImageMedia } from './media/ImageMedia';
import { MediaBackground } from './media/MediaBackground';
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
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [parentHeld, setParentHeld] = useState(false);
  const [showLoading, setShowLoading] = useState(false);

  useAnimatedReaction(
    () => held.value,
    (v, prev) => {
      if (v !== prev) scheduleOnRN(setParentHeld, v);
    }
  );

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
    durationMs: story.durationMs ?? config.imageDurationMs,
    active: isActive,
    held: parentHeld || pressed || !ready || failed,
    onComplete: goNext,
  });

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
    const t = setTimeout(() => setShowLoading(true), motion.loadingShowAfterMs);
    return () => clearTimeout(t);
  }, [isActive, ready, failed, motion.loadingShowAfterMs]);

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

  const longPress = useLongPressGesture({
    testID: 'story-long-press',
    runOnJS: true,
    minDuration: motion.longPressMs,
    maxDistance: motion.longPressMaxDistance,
    onActivate: () => setPressed(true),
    onFinalize: () => setPressed(false),
  });
  const tap = useTapGesture({
    testID: 'story-tap',
    runOnJS: true,
    maxDuration: motion.tapMaxDurationMs,
    maxDistance: motion.tapMaxDistance,
    onActivate: (e) => handleTapAt(e.x),
  });
  const gesture = useExclusiveGestures(longPress, tap);

  const uiOpacity = useSharedValue(1);
  useEffect(() => {
    uiOpacity.value = withTiming(pressed ? 0 : 1, {
      duration: reduced
        ? motion.reducedUiFadeMs
        : pressed
          ? motion.uiHideMs
          : motion.uiShowMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [pressed, uiOpacity, reduced, motion]);
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
              onDisplay={() => setReady(true)}
              onError={() => setFailed(true)}
            />
          )}
          {showLoading && <LoadingIndicator />}
        </Animated.View>
      </GestureDetector>
      <Animated.View
        testID="story-ui"
        pointerEvents={pressed ? 'none' : 'box-none'}
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
