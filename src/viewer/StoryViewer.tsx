import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
  AppState,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
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
import {
  enterUser,
  reconcileNavState,
  type NavResult,
} from '../model/navigation';
import { formatRelativeTime } from '../model/time';
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
import { userAnnouncement } from './a11y';
import { BottomScrim, Scrim } from './Scrim';
import { UserPager, type PagerCommands } from './UserPager';
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
    commandsRef,
    renderHeader,
    renderFooter,
    renderOverlay,
    hasCustomHeader,
    hasFooter,
    hasOverlay,
    onActiveUserChange,
  } = useStoryContext();
  const theme = useStoryTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const { motion } = config;

  const liveUsers = opened?.users ?? [];
  const [users, setUsers] = useState(liveUsers);
  const [nav, setNav] = useState(() => ({
    ...enterUser(initialUserIndex, liveUsers, store),
    // Bumped by "restart" so the first story's timer starts over.
    restarts: 0,
  }));
  const [activeGone, setActiveGone] = useState(false);
  // Follow the users prop: keep the viewed story by id. When its user is
  // gone the last users stay on screen while the viewer closes.
  if (liveUsers !== users && !activeGone) {
    const cur = users[nav.userIndex];
    const st = cur?.stories[nav.storyIndex];
    const r =
      cur &&
      st &&
      reconcileNavState({ userId: cur.id, storyId: st.id }, liveUsers);
    if (r) {
      setUsers(liveUsers);
      setNav((prev) => ({ ...prev, ...r }));
    } else {
      setActiveGone(true);
    }
  }
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

  useEffect(() => {
    if (activeGone) requestClose();
  }, [activeGone, requestClose]);

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

  // Parent hold for every page's timer: set from JS, read on the UI thread.
  const appBackground = useSharedValue(false);
  const screenReaderHold = useSharedValue(false);
  const apiPaused = useSharedValue(false);
  const held = useDerivedValue(
    () => appBackground.value || screenReaderHold.value || apiPaused.value
  );
  const holdForReader = !config.autoAdvanceWithScreenReader;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      appBackground.value = s !== 'active';
    });
    return () => sub.remove();
  }, [appBackground]);
  useEffect(() => {
    let live = true;
    const apply = (on: boolean) => {
      screenReaderHold.value = on && holdForReader;
    };
    AccessibilityInfo.isScreenReaderEnabled().then((on) => live && apply(on));
    const sub = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      apply
    );
    return () => {
      live = false;
      sub.remove();
    };
  }, [screenReaderHold, holdForReader]);

  const pagerCommands = useRef<PagerCommands | null>(null);
  useEffect(() => {
    commandsRef.current = {
      next: () => pagerCommands.current?.next(),
      prev: () => pagerCommands.current?.prev(),
      goToUser: (id) => pagerCommands.current?.goToUser(id),
      pause: () => {
        apiPaused.value = true;
      },
      resume: () => {
        apiPaused.value = false;
      },
    };
    return () => {
      commandsRef.current = null;
    };
  }, [commandsRef, apiPaused]);
  const toggleMagicTap = useCallback(() => {
    apiPaused.value = !apiPaused.value;
    return true;
  }, [apiPaused]);

  const formatTime = config.formatTime;
  useEffect(() => {
    if (!user || !story) return;
    const created = story.createdAt;
    const time =
      created === undefined
        ? null
        : formatTime
          ? formatTime(created)
          : formatRelativeTime(created, Date.now());
    AccessibilityInfo.announceForAccessibility(
      userAnnouncement(user.name, user.stories.length, time)
    );
    // Only when the user changes, not on every story.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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

  // Custom slots render for the active page only, each behind a component
  // boundary so their hooks stay isolated; neighbours show no custom slot.
  const renderChrome = useCallback(
    (u: StoryUser, s: StoryItem, storyIndex: number, active: boolean) => {
      const slotProps: StorySlotProps = {
        user: u,
        story: s,
        storyIndex,
        close: requestClose,
        pause: noop,
        resume: noop,
      };
      const defaultHeader = (
        <Header
          user={u}
          story={s}
          safeAreaTop={insets.top}
          onClose={requestClose}
        />
      );
      return (
        <>
          {active && hasOverlay && (
            <View
              testID="story-overlay"
              pointerEvents="box-none"
              style={StyleSheet.absoluteFill}
            >
              <SlotRenderer render={renderOverlay} props={slotProps} />
            </View>
          )}
          <Scrim safeAreaTop={insets.top} />
          {active && hasFooter && (
            <>
              <BottomScrim />
              <View
                testID="story-footer"
                pointerEvents="box-none"
                style={[styles.footer, { paddingBottom: insets.bottom }]}
              >
                <SlotRenderer render={renderFooter} props={slotProps} />
              </View>
            </>
          )}
          {!hasCustomHeader ? (
            defaultHeader
          ) : active ? (
            <SlotRenderer
              render={renderHeader}
              props={slotProps}
              fallback={defaultHeader}
            />
          ) : null}
        </>
      );
    },
    [
      hasCustomHeader,
      hasFooter,
      hasOverlay,
      renderHeader,
      renderFooter,
      renderOverlay,
      requestClose,
      insets.top,
      insets.bottom,
    ]
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
        onMagicTap={toggleMagicTap}
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
              externalHeld={held}
              commandsRef={pagerCommands}
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

/** Renders a slot; `undefined` (not null) falls back when one is given. */
function SlotRenderer({
  render,
  props,
  fallback,
}: {
  render(p: StorySlotProps): ReactNode;
  props: StorySlotProps;
  fallback?: ReactNode;
}) {
  const out = render(props);
  return <>{out === undefined ? fallback : out}</>;
}

const styles = StyleSheet.create({
  frame: { position: 'absolute', overflow: 'hidden' },
  fill: { flex: 1 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
