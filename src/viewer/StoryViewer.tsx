import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import {
  dismissProgress,
  dismissStyle,
  lerpRect,
  rubberBand,
} from '../model/gestureMath';
import { enterUser, type NavResult } from '../model/navigation';
import { measureWithTimeout } from '../provider/rectRegistry';
import {
  useStoryContext,
  type StorySlotProps,
} from '../provider/StoryProvider';
import { useStoryTheme } from '../theme/StoryThemeProvider';
import type { Rect, StoryItem, StoryUser } from '../types';
import { Header } from './Header';
import { nextVideoTarget, preloadTargets, usePreload } from './media/preload';
import { VideoSlotsProvider } from './media/videoSlots';
import { Scrim } from './Scrim';
import { UserPager } from './UserPager';
import { ViewerContext } from './viewerContext';

export interface StoryViewerProps {
  initialUserIndex: number;
  sourceRect: Rect | null;
  onClosed(): void;
}

export function StoryViewer({
  initialUserIndex,
  sourceRect,
  onClosed,
}: StoryViewerProps) {
  const {
    config,
    store,
    registry,
    opened,
    closerRef,
    renderHeader,
    hasCustomHeader,
    onActiveUserChange,
  } = useStoryContext();
  const theme = useStoryTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const { motion } = config;

  const users = opened?.users ?? [];
  const [nav, setNav] = useState(() => ({
    ...enterUser(initialUserIndex, users, store),
    // Bumped by "restart" so the first story's timer starts over.
    restarts: 0,
  }));
  const user = users[nav.userIndex];
  const story = user?.stories[nav.storyIndex];
  usePreload(users, nav);
  const lastViewed = useRef<Record<string, number>>({});

  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  const finish = useCallback(() => onClosedRef.current(), []);

  const useRect = !reduced;
  // 0 = at bubble (or invisible), 1 = full screen.
  const progress = useSharedValue(0);
  const rect = useSharedValue<Rect | null>(useRect ? sourceRect : null);
  const isClosing = useSharedValue(false);
  const isTransitioning = useSharedValue(false);
  // Vertical drag: > 0 dismiss, < 0 swipe-up.
  const dragY = useSharedValue(0);
  const closingRef = useRef(false);
  const fadeMs = reduced ? motion.reducedOpenCloseMs : motion.closeNoRectMs;

  useEffect(() => {
    progress.value = rect.value
      ? withTiming(1, {
          duration: motion.openMs,
          easing: Easing.bezier(...motion.openBezier),
        })
      : withTiming(1, { duration: fadeMs });
  }, [progress, rect, motion.openMs, motion.openBezier, fadeMs]);

  const userId = user?.id;
  const requestClose = useCallback(() => {
    if (closingRef.current || !userId) return;
    closingRef.current = true;
    isClosing.value = true;
    const run = async () => {
      const measured = useRect
        ? await measureWithTimeout(registry, userId, motion.measureTimeoutMs)
        : null;
      rect.value = measured;
      const done = (finished?: boolean) => {
        'worklet';
        if (finished) scheduleOnRN(finish);
      };
      const timing = measured
        ? {
            duration: motion.closeMs,
            easing: Easing.bezier(...motion.closeBezier),
          }
        : { duration: fadeMs };
      // A dismiss drag hands over to the close animation from where it is.
      dragY.value = withTiming(0, timing);
      progress.value = withTiming(0, timing, done);
    };
    run();
  }, [
    userId,
    useRect,
    registry,
    motion.measureTimeoutMs,
    motion.closeMs,
    motion.closeBezier,
    fadeMs,
    progress,
    rect,
    isClosing,
    dragY,
    finish,
  ]);

  const onNav = useCallback(
    (r: NavResult) => {
      if (r.kind === 'close') {
        requestClose();
        return;
      }
      if (userId) lastViewed.current[userId] = nav.storyIndex;
      setNav((prev) => ({
        ...r.state,
        restarts:
          r.kind === 'user'
            ? 0
            : prev.restarts + (r.kind === 'restart' ? 1 : 0),
      }));
    },
    [requestClose, userId, nav.storyIndex]
  );

  const onMediaFirstFrame = useCallback(
    (item: StoryItem) => {
      if (userId) store.markSeen(item.id, userId);
    },
    [store, userId]
  );

  // Close shrinks back to the active user's bubble; that one is hidden.
  useEffect(() => {
    if (userId) onActiveUserChange(userId);
  }, [userId, onActiveUserChange]);

  useEffect(() => {
    closerRef.current = requestClose;
    return () => {
      closerRef.current = null;
    };
  }, [closerRef, requestClose]);

  const openFade = motion.openContentFadeRatio;
  const closeFade = motion.closeContentFadeRatio;
  const noRectScale = motion.closeNoRectScale;

  const frameStyle = useAnimatedStyle(() => {
    const y = dragY.value;
    const d = dismissStyle(
      y > 0 ? dismissProgress(y, height, motion) : 0,
      motion
    );
    // Reduce motion: dismiss is a background fade only.
    const dragScale = reduced ? 1 : d.scale;
    const dragRadius = reduced ? 0 : d.borderRadius;
    // Down follows 1:1; up is dampened and capped.
    const translateY =
      y > 0
        ? y
        : Math.max(
            -motion.swipeUpFollowMax,
            rubberBand(y, height, motion.rubberBandFactor)
          );
    const from = rect.value;
    if (!from) {
      const closeScale =
        isClosing.value && !reduced
          ? noRectScale + (1 - noRectScale) * progress.value
          : 1;
      return {
        left: 0,
        top: 0,
        width,
        height,
        opacity: progress.value,
        borderRadius: dragRadius,
        transform: [{ translateY }, { scale: closeScale * dragScale }],
      };
    }
    const r = lerpRect(from, { x: 0, y: 0, width, height }, progress.value);
    return {
      left: r.x,
      top: r.y,
      width: r.width,
      height: r.height,
      opacity: 1,
      borderRadius: Math.max(
        (from.width / 2) * (1 - progress.value),
        dragRadius
      ),
      transform: [{ translateY }, { scale: dragScale }],
    };
  });

  const backdropStyle = useAnimatedStyle(() => {
    const y = dragY.value;
    const d = dismissStyle(
      y > 0 ? dismissProgress(y, height, motion) : 0,
      motion
    );
    // Shown once open; fades with the close, never during the open.
    const shown = isClosing.value
      ? progress.value
      : progress.value >= 1
        ? 1
        : 0;
    return { opacity: shown * d.bgOpacity };
  });

  const contentStyle = useAnimatedStyle(() => {
    if (!rect.value) return { opacity: 1 };
    const p = progress.value;
    const o = isClosing.value
      ? (p - (1 - closeFade)) / closeFade
      : p / openFade;
    return { opacity: Math.min(Math.max(o, 0), 1) };
  });

  const controls = useMemo(
    () => ({ requestClose, isClosing, isTransitioning }),
    [requestClose, isClosing, isTransitioning]
  );

  // A custom header renders for the active page only, behind a component
  // boundary so its hooks stay isolated; neighbours then show no header.
  const renderChrome = useCallback(
    (u: StoryUser, s: StoryItem, storyIndex: number, active: boolean) => (
      <>
        <Scrim safeAreaTop={insets.top} />
        {!hasCustomHeader ? (
          <Header
            user={u}
            story={s}
            safeAreaTop={insets.top}
            onClose={requestClose}
          />
        ) : active ? (
          <SlotRenderer
            render={renderHeader}
            props={{
              user: u,
              story: s,
              storyIndex,
              close: requestClose,
              pause: noop,
              resume: noop,
            }}
          />
        ) : null}
      </>
    ),
    [hasCustomHeader, renderHeader, requestClose, insets.top]
  );

  if (!user || !story) return null;
  const nextVideo = nextVideoTarget(preloadTargets(users, nav, store));

  return (
    <ViewerContext.Provider value={controls}>
      <Animated.View
        testID="story-backdrop"
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: theme.viewer.dismissBg },
          backdropStyle,
        ]}
      />
      <Animated.View
        testID="story-viewer"
        accessibilityViewIsModal
        style={[
          styles.frame,
          { backgroundColor: theme.viewer.bgFallback },
          frameStyle,
        ]}
      >
        <Animated.View style={[styles.fill, contentStyle]}>
          <VideoSlotsProvider active={story} next={nextVideo}>
            <UserPager
              users={users}
              nav={nav}
              lastViewed={lastViewed.current}
              dragY={dragY}
              onNav={onNav}
              onMediaFirstFrame={onMediaFirstFrame}
              renderChrome={renderChrome}
            />
          </VideoSlotsProvider>
        </Animated.View>
      </Animated.View>
    </ViewerContext.Provider>
  );
}

const noop = () => {};

function SlotRenderer({
  render,
  props,
}: {
  render(p: StorySlotProps): ReactNode;
  props: StorySlotProps;
}) {
  return <>{render(props)}</>;
}

const styles = StyleSheet.create({
  frame: { position: 'absolute', overflow: 'hidden' },
  fill: { flex: 1 },
});
