import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type AccessibilityActionEvent,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  type ComposedGesture,
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
import {
  useStoryContext,
  type StorySlotProps,
} from '../provider/StoryProvider';
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
  /** While true, a finished story or media error does not auto-advance. */
  advanceBlocked?: SharedValue<boolean>;
  /** While true, taps and long-presses are ignored (user transition, close). */
  inputBlocked?: SharedValue<boolean>;
  /** Pager pans; they compete with this page's tap and long-press. */
  pagerGesture?: ComposedGesture;
  /** Extra multiplier for the chrome opacity (drag-down dismiss). */
  chromeOpacity?: SharedValue<number>;
  /** Bumped to restart the current story from 0. */
  restartToken?: number;
  onNav(r: NavResult): void;
  onMediaFirstFrame(story: StoryItem): void;
  /** Props handed to the app's `renderContent` and `renderMediaFrame`. */
  slotProps: StorySlotProps;
  /** Chrome (scrim, header) drawn over the media; hidden while pressing. */
  children?: ReactNode;
}

/** One user's page. Remounts per story so timer and media state reset. */
export function UserPage(props: UserPageProps) {
  const story = props.user.stories[props.storyIndex];
  if (!story) return null;
  return (
    <StoryPage
      key={`${story.id}:${props.restartToken ?? 0}`}
      story={story}
      {...props}
    />
  );
}

function StoryPage({
  story,
  user,
  storyIndex,
  users,
  lastViewed,
  isActive,
  held,
  advanceBlocked,
  inputBlocked,
  pagerGesture,
  chromeOpacity,
  onNav,
  onMediaFirstFrame,
  slotProps,
  children,
}: UserPageProps & { story: StoryItem }) {
  const { config, renderContent, renderMediaFrame, hideChrome } =
    useStoryContext();
  const { motion, strings } = config;
  const a11yActions = [
    { name: 'next', label: strings.nextStory },
    { name: 'prev', label: strings.prevStory },
  ];
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

  const autoAdvance = useCallback(() => {
    if (!advanceBlocked?.value) goNext();
  }, [advanceBlocked, goNext]);

  const { progress } = useStoryTimer({
    durationMs:
      story.durationMs ??
      (story.type === 'video' ? videoMs : null) ??
      config.imageDurationMs,
    active: isActive,
    held: timerHeld,
    onComplete: autoAdvance,
  });

  // App-supplied media replaces ours and is ready from the first render.
  const pageSlotProps = { ...slotProps, active: isActive };
  const custom = renderContent(pageSlotProps);
  const hasCustom = custom !== undefined;
  useEffect(() => {
    if (!hasCustom) return;
    setReady(true);
    mediaBlocked.value = false;
  }, [hasCustom, mediaBlocked]);

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
    const t = setTimeout(autoAdvance, config.mediaErrorAdvanceMs);
    return () => clearTimeout(t);
  }, [isActive, failed, autoAdvance, config.mediaErrorAdvanceMs]);

  useEffect(() => {
    if (!isActive || ready || failed) {
      setShowLoading(false);
      return;
    }
    const t = setTimeout(() => setShowLoading(true), loading.showAfterMs);
    return () => clearTimeout(t);
  }, [isActive, ready, failed, loading.showAfterMs]);

  const goPrev = useCallback(() => {
    const c = navRef.current;
    c.onNav(tapPrev(c.navState, c.users, c.lastViewed));
  }, []);

  const onA11yAction = useCallback(
    (e: AccessibilityActionEvent) => {
      if (e.nativeEvent.actionName === 'next') goNext();
      else if (e.nativeEvent.actionName === 'prev') goPrev();
    },
    [goNext, goPrev]
  );

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

  const gesture = useMemo(() => {
    const longPress = Gesture.LongPress()
      .minDuration(motion.longPressMs)
      .maxDistance(motion.longPressMaxDistance)
      .onStart(() => {
        'worklet';
        if (inputBlocked?.value) return;
        pressed.value = true;
        cancelAnimation(progress);
        uiOpacity.value = withTiming(0, {
          duration: hideMs,
          easing: Easing.out(Easing.cubic),
        });
        scheduleOnRN(setUiHidden, true);
      })
      .onFinalize(() => {
        'worklet';
        if (!pressed.value) return;
        pressed.value = false;
        uiOpacity.value = withTiming(1, {
          duration: showMs,
          easing: Easing.out(Easing.cubic),
        });
        scheduleOnRN(setUiHidden, false);
      });
    const tap = Gesture.Tap()
      .maxDuration(motion.tapMaxDurationMs)
      .maxDistance(motion.tapMaxDistance)
      .onStart((e) => {
        'worklet';
        if (inputBlocked?.value) return;
        scheduleOnRN(handleTapAt, e.x);
      });
    if (isActive) {
      longPress.withTestId('story-long-press');
      tap.withTestId('story-tap');
    }
    // The long-press has priority; the tap only runs if it fails.
    const pageGesture = Gesture.Exclusive(longPress, tap);
    // First gesture to activate wins (pager pans vs. tap/long-press).
    return Gesture.Race(
      ...(pagerGesture ? [pagerGesture, pageGesture] : [pageGesture])
    );
  }, [
    motion.longPressMs,
    motion.longPressMaxDistance,
    motion.tapMaxDurationMs,
    motion.tapMaxDistance,
    isActive,
    inputBlocked,
    pressed,
    progress,
    uiOpacity,
    hideMs,
    showMs,
    handleTapAt,
    pagerGesture,
  ]);
  // Controlled content-only mode, on top of the long-press hide.
  const chromeShown = useSharedValue(hideChrome ? 0 : 1);
  useEffect(() => {
    chromeShown.value = withTiming(hideChrome ? 0 : 1, {
      duration: hideChrome ? hideMs : showMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [hideChrome, hideMs, showMs, chromeShown]);
  const uiStyle = useAnimatedStyle(() => ({
    opacity: uiOpacity.value * chromeShown.value * (chromeOpacity?.value ?? 1),
  }));

  const media = hasCustom ? (
    custom
  ) : (
    <>
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
    </>
  );

  return (
    <View style={styles.fill}>
      <GestureDetector gesture={gesture}>
        <Animated.View
          testID="story-tap-area"
          style={styles.fill}
          accessible={isActive ? true : undefined}
          accessibilityActions={isActive ? a11yActions : undefined}
          onAccessibilityAction={isActive ? onA11yAction : undefined}
        >
          <MediaBackground story={story} />
          <View
            style={[
              styles.fill,
              config.mediaSafeAreaTop && { marginTop: insets.top },
            ]}
          >
            {renderMediaFrame(media, pageSlotProps)}
          </View>
          {showLoading && <LoadingIndicator />}
        </Animated.View>
      </GestureDetector>
      <Animated.View
        testID="story-ui"
        pointerEvents={uiHidden || hideChrome ? 'none' : 'box-none'}
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
