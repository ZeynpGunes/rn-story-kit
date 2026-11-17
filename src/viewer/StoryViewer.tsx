import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { lerpRect } from '../model/gestureMath';
import { enterUser, type NavResult } from '../model/navigation';
import { measureWithTimeout } from '../provider/rectRegistry';
import { useStoryContext } from '../provider/StoryProvider';
import { useStoryTheme } from '../theme/StoryThemeProvider';
import type { Rect, StoryItem } from '../types';
import { Header } from './Header';
import { Scrim } from './Scrim';
import { UserPage } from './UserPage';

export interface StoryViewerProps {
  initialUserIndex: number;
  sourceRect: Rect | null;
  onClosed(): void;
}

export interface ViewerControls {
  requestClose(): void;
  isClosing: SharedValue<boolean>;
}

const ViewerContext = createContext<ViewerControls | null>(null);

/** Internal: close controls for the viewer's pages, header and gestures. */
export function useViewerControls(): ViewerControls {
  const ctx = useContext(ViewerContext);
  if (!ctx) throw new Error('rn-story-kit: useViewerControls outside viewer');
  return ctx;
}

export function StoryViewer({
  initialUserIndex,
  sourceRect,
  onClosed,
}: StoryViewerProps) {
  const { config, store, registry, opened, closerRef, renderHeader } =
    useStoryContext();
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
  const held = useSharedValue(false);
  const lastViewed = useRef<Record<string, number>>({});

  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  const finish = useCallback(() => onClosedRef.current(), []);

  const useRect = !reduced;
  // 0 = at bubble (or invisible), 1 = full screen.
  const progress = useSharedValue(0);
  const rect = useSharedValue<Rect | null>(useRect ? sourceRect : null);
  const isClosing = useSharedValue(false);
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
      progress.value = measured
        ? withTiming(
            0,
            {
              duration: motion.closeMs,
              easing: Easing.bezier(...motion.closeBezier),
            },
            done
          )
        : withTiming(0, { duration: fadeMs }, done);
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
        restarts: prev.restarts + (r.kind === 'restart' ? 1 : 0),
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
    const from = rect.value;
    if (!from) {
      return {
        left: 0,
        top: 0,
        width,
        height,
        opacity: progress.value,
        transform: [
          {
            scale:
              isClosing.value && !reduced
                ? noRectScale + (1 - noRectScale) * progress.value
                : 1,
          },
        ],
      };
    }
    const r = lerpRect(from, { x: 0, y: 0, width, height }, progress.value);
    return {
      left: r.x,
      top: r.y,
      width: r.width,
      height: r.height,
      opacity: 1,
      borderRadius: (from.width / 2) * (1 - progress.value),
    };
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
    () => ({ requestClose, isClosing }),
    [requestClose, isClosing]
  );

  if (!user || !story) return null;
  const slot = {
    user,
    story,
    storyIndex: nav.storyIndex,
    close: requestClose,
    pause: () => {},
    resume: () => {},
  };
  const customHeader = renderHeader(slot);

  return (
    <ViewerContext.Provider value={controls}>
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
          <UserPage
            key={`${user.id}:${nav.restarts}`}
            user={user}
            storyIndex={nav.storyIndex}
            users={users}
            lastViewed={lastViewed.current}
            isActive
            held={held}
            onNav={onNav}
            onMediaFirstFrame={onMediaFirstFrame}
          >
            <Scrim safeAreaTop={insets.top} />
            {customHeader !== undefined ? (
              customHeader
            ) : (
              <Header
                user={user}
                story={story}
                safeAreaTop={insets.top}
                onClose={requestClose}
              />
            )}
          </UserPage>
        </Animated.View>
      </Animated.View>
    </ViewerContext.Provider>
  );
}

const styles = StyleSheet.create({
  frame: { position: 'absolute', overflow: 'hidden' },
  fill: { flex: 1 },
});
