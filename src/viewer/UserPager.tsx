import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { StoryConfig } from '../config';
import {
  cubeTransform,
  dismissProgress,
  dismissStyle,
  rubberBand,
  shouldDismiss,
  shouldSwipeUp,
  swipeDecision,
  type TransformEntry,
} from '../model/gestureMath';
import {
  enterUser,
  swipeToUser,
  tapNext,
  tapPrev,
  type NavResult,
  type NavState,
} from '../model/navigation';
import {
  useStoryContext,
  type StorySlotProps,
} from '../provider/StoryProvider';
import type { StoryItem, StoryUser } from '../types';
import { UserPage } from './UserPage';
import { useViewerControls } from './viewerContext';

type Motion = StoryConfig['motion'];
/** Page position relative to the active user: previous, active, next. */
type Role = -1 | 0 | 1;
type UserNav = Extract<NavResult, { kind: 'user' }>;
type SpringConfig = {
  damping: number;
  stiffness: number;
  mass: number;
  overshootClamping?: boolean;
};

const ROLES: Role[] = [-1, 0, 1];

export interface PagerCommands {
  next(): void;
  prev(): void;
  goToUser(userId: string): void;
}

export interface UserPagerProps {
  users: StoryUser[];
  nav: NavState & { restarts: number };
  /** userId -> last viewed story index, for previous-user taps. */
  lastViewed: Record<string, number>;
  /** Hold from outside the pager (app background, screen reader, API). */
  externalHeld: SharedValue<boolean>;
  /** While true, finished timers and error timeouts do not advance. */
  advanceBlocked: SharedValue<boolean>;
  /** Receives the pager's navigation commands while mounted. */
  commandsRef: { current: PagerCommands | null };
  /** Vertical drag offset; the viewer frame follows it (dismiss/swipe-up). */
  dragY: SharedValue<number>;
  /** Applies a navigation; user changes arrive only after their transition. */
  onNav(r: NavResult): void;
  onMediaFirstFrame(story: StoryItem): void;
  renderChrome(
    user: StoryUser,
    story: StoryItem,
    storyIndex: number,
    active: boolean
  ): ReactNode;
  /** Slot props for a page's custom content and media frame. */
  slotPropsFor(
    user: StoryUser,
    story: StoryItem,
    storyIndex: number
  ): StorySlotProps;
}

/**
 * Mounts the previous, active and next user pages and owns the horizontal
 * cube swipe, the vertical dismiss/swipe-up pan and user transitions.
 */
export function UserPager({
  users,
  nav,
  lastViewed,
  externalHeld,
  advanceBlocked,
  commandsRef,
  dragY,
  onNav,
  onMediaFirstFrame,
  renderChrome,
  slotPropsFor,
}: UserPagerProps) {
  const { config, store, onSwipeUp } = useStoryContext();
  const { requestClose, isClosing, isTransitioning } = useViewerControls();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const m = config.motion;

  // Active user index on the UI thread. Page roles derive from it, so a
  // transition hands over in one UI frame; React only mounts and unmounts.
  const activeIndex = useSharedValue(nav.userIndex);
  const count = users.length;
  // Horizontal page offset in px; negative = finger left = next user.
  const offset = useSharedValue(0);
  // Reduced-motion crossfade progress and the side of the incoming user.
  const fade = useSharedValue(0);
  const fadeSide = useSharedValue<Role>(0);
  const dragging = useSharedValue(false);
  const panIgnored = useSharedValue(false);
  const held = useDerivedValue(
    () => dragging.value || isTransitioning.value || externalHeld.value
  );
  const inputBlocked = useDerivedValue(
    () => isTransitioning.value || isClosing.value
  );
  const chromeOpacity = useDerivedValue(() =>
    dragY.value > 0
      ? dismissStyle(dismissProgress(dragY.value, height, m), m).uiOpacity
      : 1
  );

  const lastViewedRef = useRef(lastViewed);
  lastViewedRef.current = lastViewed;
  const [pending, setPending] = useState<UserNav | null>(null);
  const busy = useRef(false);
  const latest = useRef({ nav, users, onNav });
  latest.current = { nav, users, onNav };

  // Align the UI state with React's active user and release input.
  const resetTransition = useCallback(() => {
    activeIndex.value = latest.current.nav.userIndex;
    offset.value = 0;
    fade.value = 0;
    fadeSide.value = 0;
    dragging.value = false;
    isTransitioning.value = false;
    busy.current = false;
    setPending(null);
  }, [activeIndex, offset, fade, fadeSide, dragging, isTransitioning]);

  useLayoutEffect(resetTransition, [nav.userIndex, resetTransition]);

  /**
   * UI thread, at the end of a transition: switch roles and drop the offset
   * in the same frame. False while closing: the user must not change then.
   */
  const handOver = useCallback(
    (direction: 1 | -1) => {
      'worklet';
      if (isClosing.value) return false;
      activeIndex.value = activeIndex.value + direction;
      offset.value = 0;
      fade.value = 0;
      fadeSide.value = 0;
      return true;
    },
    [isClosing, activeIndex, offset, fade, fadeSide]
  );

  const commit = useCallback((r: UserNav) => {
    setPending(null);
    latest.current.onNav(r);
  }, []);

  const commitSwipe = useCallback(
    (direction: 1 | -1) => {
      const c = latest.current;
      const r = swipeToUser(c.nav, direction, c.users, store);
      if (r?.kind === 'user') commit(r);
      else resetTransition();
    },
    [store, commit, resetTransition]
  );

  const swipeUp = useCallback(() => {
    const c = latest.current;
    const user = c.users[c.nav.userIndex];
    const story = user?.stories[c.nav.storyIndex];
    if (user && story) onSwipeUp(story, user);
  }, [onSwipeUp]);

  const onPageNav = useCallback(
    (r: NavResult) => {
      if (busy.current || isTransitioning.value) return;
      if (r.kind !== 'user') {
        latest.current.onNav(r);
        return;
      }
      busy.current = true;
      isTransitioning.value = true;
      setPending(r);
    },
    [isTransitioning]
  );

  // Imperative navigation takes the same path as taps and a11y actions.
  useEffect(() => {
    commandsRef.current = {
      next: () => {
        const c = latest.current;
        onPageNav(tapNext(c.nav, c.users));
      },
      prev: () => {
        const c = latest.current;
        onPageNav(tapPrev(c.nav, c.users, lastViewedRef.current));
      },
      goToUser: (userId) => {
        const c = latest.current;
        const index = c.users.findIndex((u) => u.id === userId);
        const delta = index - c.nav.userIndex;
        if (index === -1 || delta === 0) return;
        const r: UserNav = {
          kind: 'user',
          direction: delta > 0 ? 1 : -1,
          state: enterUser(index, c.users, store),
        };
        // Only the neighbours are mounted: farther targets jump, no cube.
        if (Math.abs(delta) === 1) onPageNav(r);
        else if (!busy.current && !isTransitioning.value) {
          // Align the UI-thread index before React re-renders the pages.
          activeIndex.value = index;
          c.onNav(r);
        }
      },
    };
    return () => {
      commandsRef.current = null;
    };
  }, [commandsRef, onPageNav, store, isTransitioning, activeIndex]);

  // Programmatic user change: animate once the target page is rendered.
  useEffect(() => {
    if (!pending) return;
    const done = (finished?: boolean) => {
      'worklet';
      if (finished && handOver(pending.direction)) {
        scheduleOnRN(commit, pending);
      }
    };
    if (reduced) {
      fadeSide.value = pending.direction;
      fade.value = withTiming(1, { duration: m.reducedCubeFadeMs }, done);
    } else {
      offset.value = withTiming(
        -pending.direction * width,
        {
          duration: m.cubeProgrammaticMs,
          easing: Easing.bezier(...m.cubeProgrammaticBezier),
        },
        done
      );
    }
  }, [
    pending,
    reduced,
    width,
    m.reducedCubeFadeMs,
    m.cubeProgrammaticMs,
    m.cubeProgrammaticBezier,
    commit,
    handOver,
    offset,
    fade,
    fadeSide,
  ]);

  const canGo = useCallback(
    (direction: number) => {
      'worklet';
      return direction === 1
        ? activeIndex.value < count - 1
        : direction === -1 && activeIndex.value > 0;
    },
    [activeIndex, count]
  );
  const settleSpring = useMemo<SpringConfig>(
    () => ({
      damping: m.cubeSettleDamping,
      stiffness: m.cubeSettleStiffness,
      mass: m.cubeSettleMass,
      overshootClamping: true,
    }),
    [m.cubeSettleDamping, m.cubeSettleStiffness, m.cubeSettleMass]
  );
  const rubberSpring = useMemo<SpringConfig>(
    () => ({
      damping: m.rubberBandDamping,
      stiffness: m.rubberBandStiffness,
      mass: m.rubberBandMass,
    }),
    [m.rubberBandDamping, m.rubberBandStiffness, m.rubberBandMass]
  );
  const snapSpring = useMemo<SpringConfig>(
    () => ({
      damping: m.dismissSnapDamping,
      stiffness: m.dismissSnapStiffness,
      mass: m.dismissSnapMass,
    }),
    [m.dismissSnapDamping, m.dismissSnapStiffness, m.dismissSnapMass]
  );

  const settle = useCallback(
    (to: number, spring: SpringConfig, done: (finished?: boolean) => void) => {
      'worklet';
      return reduced
        ? withTiming(to, { duration: m.reducedSpringMs }, done)
        : withSpring(to, spring, done);
    },
    [reduced, m.reducedSpringMs]
  );
  const release = useCallback(
    (finished?: boolean) => {
      'worklet';
      if (finished) dragging.value = false;
    },
    [dragging]
  );
  const startDrag = useCallback(() => {
    'worklet';
    panIgnored.value = inputBlocked.value;
    if (!panIgnored.value) dragging.value = true;
    return !panIgnored.value;
  }, [panIgnored, inputBlocked, dragging]);
  const followX = useCallback(
    (dx: number) => {
      'worklet';
      return canGo(dx < 0 ? 1 : -1)
        ? Math.max(-width, Math.min(width, dx))
        : rubberBand(dx, width, m.rubberBandFactor);
    },
    [canGo, width, m.rubberBandFactor]
  );

  const panX = useMemo(
    () =>
      Gesture.Pan()
        .withTestId('story-pan-x')
        .activeOffsetX([-m.panActiveOffsetX, m.panActiveOffsetX])
        .failOffsetY([-m.panFailOffsetY, m.panFailOffsetY])
        .onStart((e) => {
          'worklet';
          if (startDrag()) offset.value = followX(e.translationX);
        })
        .onUpdate((e) => {
          'worklet';
          if (!panIgnored.value) offset.value = followX(e.translationX);
        })
        .onEnd((e, success) => {
          'worklet';
          if (panIgnored.value) return;
          const dir = success
            ? swipeDecision(e.translationX, e.velocityX, width, m)
            : 0;
          if (dir !== 0 && canGo(dir)) {
            isTransitioning.value = true;
            offset.value = settle(-dir * width, settleSpring, (finished) => {
              'worklet';
              if (finished && handOver(dir)) scheduleOnRN(commitSwipe, dir);
            });
            return;
          }
          const atEdge = !canGo(e.translationX < 0 ? 1 : -1);
          offset.value = settle(
            0,
            atEdge ? rubberSpring : settleSpring,
            release
          );
        }),
    [
      m,
      width,
      startDrag,
      followX,
      canGo,
      settle,
      release,
      handOver,
      commitSwipe,
      settleSpring,
      rubberSpring,
      offset,
      panIgnored,
      isTransitioning,
    ]
  );

  const panY = useMemo(
    () =>
      Gesture.Pan()
        .withTestId('story-pan-y')
        .activeOffsetY([-m.dismissActiveOffsetY, m.dismissActiveOffsetY])
        .onStart((e) => {
          'worklet';
          if (startDrag()) dragY.value = e.translationY;
        })
        .onUpdate((e) => {
          'worklet';
          if (!panIgnored.value) dragY.value = e.translationY;
        })
        .onEnd((e, success) => {
          'worklet';
          if (panIgnored.value) return;
          const dy = e.translationY;
          const vy = e.velocityY;
          if (success && dy > 0 && shouldDismiss(dy, vy, m)) {
            // The viewer's close animation takes dragY back to 0.
            scheduleOnRN(requestClose);
            return;
          }
          if (success && dy < 0 && shouldSwipeUp(dy, vy, m)) {
            scheduleOnRN(swipeUp);
          }
          dragY.value = settle(0, snapSpring, release);
        }),
    [
      m,
      startDrag,
      settle,
      release,
      snapSpring,
      requestClose,
      swipeUp,
      dragY,
      panIgnored,
    ]
  );

  // First pan to activate wins; the other is cancelled.
  const pagerGesture = useMemo(() => Gesture.Race(panX, panY), [panX, panY]);

  return (
    <>
      {ROLES.map((role) => {
        const index = nav.userIndex + role;
        const user = users[index];
        if (!user) return null;
        const storyIndex =
          role === 0
            ? nav.storyIndex
            : pending?.state.userIndex === index
              ? pending.state.storyIndex
              : enterUser(index, users, store).storyIndex;
        const story = user.stories[storyIndex];
        if (!story) return null;
        return (
          <PagerSlot
            key={user.id}
            testID={`story-page-${user.id}`}
            active={role === 0}
            slotIndex={index}
            activeIndex={activeIndex}
            count={count}
            offset={offset}
            fade={fade}
            fadeSide={fadeSide}
            reduced={reduced}
            width={width}
            m={m}
          >
            <UserPage
              user={user}
              storyIndex={storyIndex}
              users={users}
              lastViewed={lastViewed}
              isActive={role === 0}
              held={held}
              advanceBlocked={advanceBlocked}
              inputBlocked={inputBlocked}
              pagerGesture={role === 0 ? pagerGesture : undefined}
              chromeOpacity={chromeOpacity}
              restartToken={role === 0 ? nav.restarts : 0}
              onNav={onPageNav}
              onMediaFirstFrame={onMediaFirstFrame}
              slotProps={slotPropsFor(user, story, storyIndex)}
            >
              {renderChrome(user, story, storyIndex, role === 0)}
            </UserPage>
          </PagerSlot>
        );
      })}
    </>
  );
}

interface PagerSlotProps {
  testID: string;
  /** React's view of the active page: touches and accessibility. */
  active: boolean;
  /** This page's user index; its role is slotIndex - activeIndex. */
  slotIndex: number;
  activeIndex: SharedValue<number>;
  count: number;
  offset: SharedValue<number>;
  fade: SharedValue<number>;
  fadeSide: SharedValue<Role>;
  reduced: boolean;
  width: number;
  m: Motion;
  children: ReactNode;
}

/** Puts the page's layout offset right after the leading perspective. */
const place = (t: TransformEntry[], translateX: number) => {
  'worklet';
  return [t[0]!, { translateX }, ...t.slice(1)];
};

function PagerSlot({
  testID,
  active,
  slotIndex,
  activeIndex,
  count,
  offset,
  fade,
  fadeSide,
  reduced,
  width,
  m,
  children,
}: PagerSlotProps) {
  const style = useAnimatedStyle(() => {
    const role = slotIndex - activeIndex.value;
    const x = offset.value;
    const crossfade = fadeSide.value !== 0;
    // Incoming user is on the side the finger drags toward; none at rest.
    const side = x < 0 ? 1 : x > 0 ? -1 : fadeSide.value;
    if (role === 0) {
      if (crossfade) {
        return { opacity: 1 - fade.value, transform: [{ translateX: 0 }] };
      }
      const target = activeIndex.value + side;
      const hasIncoming = side !== 0 && target >= 0 && target < count;
      if (reduced || !hasIncoming) {
        return { opacity: 1, transform: [{ translateX: x }] };
      }
      const c = cubeTransform(
        x / width,
        width,
        'outgoing',
        m.cubePerspective,
        m
      );
      return { opacity: 1, transform: place(c.transform, x) };
    }
    if (role !== side) return { opacity: 0, transform: [{ translateX: 0 }] };
    if (crossfade)
      return { opacity: fade.value, transform: [{ translateX: 0 }] };
    const base = x + role * width;
    if (reduced) return { opacity: 1, transform: [{ translateX: base }] };
    const c = cubeTransform(x / width, width, 'incoming', m.cubePerspective, m);
    return { opacity: 1, transform: place(c.transform, base) };
  });

  const shadeStyle = useAnimatedStyle(() => {
    const role = slotIndex - activeIndex.value;
    const x = offset.value;
    if (role === 0 || reduced || x * role >= 0) return { opacity: 0 };
    return {
      opacity: cubeTransform(x / width, width, 'incoming', m.cubePerspective, m)
        .shadeOpacity,
    };
  });

  return (
    <Animated.View
      testID={testID}
      pointerEvents={active ? 'auto' : 'none'}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      style={[StyleSheet.absoluteFill, style]}
    >
      {children}
      {!active && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.shade, shadeStyle]}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ shade: { backgroundColor: '#000' } });
