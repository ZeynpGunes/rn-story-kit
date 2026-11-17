import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import {
  useCompetingGestures,
  usePanGesture,
} from 'react-native-gesture-handler';
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
} from '../model/gestureMath';
import {
  enterUser,
  swipeToUser,
  type NavResult,
  type NavState,
} from '../model/navigation';
import { useStoryContext } from '../provider/StoryProvider';
import type { StoryItem, StoryUser } from '../types';
import { useViewerControls } from './StoryViewer';
import { UserPage } from './UserPage';

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

export interface UserPagerProps {
  users: StoryUser[];
  nav: NavState & { restarts: number };
  /** userId -> last viewed story index, for previous-user taps. */
  lastViewed: Record<string, number>;
  /** Vertical drag offset; the viewer frame follows it (dismiss/swipe-up). */
  dragY: SharedValue<number>;
  /** Applies a navigation; user changes arrive only after their transition. */
  onNav(r: NavResult): void;
  onMediaFirstFrame(story: StoryItem): void;
  renderChrome(
    user: StoryUser,
    story: StoryItem,
    storyIndex: number
  ): ReactNode;
}

/**
 * Mounts the previous, active and next user pages and owns the horizontal
 * cube swipe, the vertical dismiss/swipe-up pan and user transitions.
 */
export function UserPager({
  users,
  nav,
  lastViewed,
  dragY,
  onNav,
  onMediaFirstFrame,
  renderChrome,
}: UserPagerProps) {
  const { config, store, onSwipeUp } = useStoryContext();
  const { requestClose, isClosing, isTransitioning } = useViewerControls();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const m = config.motion;

  // Horizontal page offset in px; negative = finger left = next user.
  const offset = useSharedValue(0);
  // Reduced-motion crossfade progress and the side of the incoming user.
  const fade = useSharedValue(0);
  const fadeSide = useSharedValue<Role>(0);
  const dragging = useSharedValue(false);
  const panIgnored = useSharedValue(false);
  const held = useDerivedValue(() => dragging.value || isTransitioning.value);
  const inputBlocked = useDerivedValue(
    () => isTransitioning.value || isClosing.value
  );
  const chromeOpacity = useDerivedValue(() =>
    dragY.value > 0
      ? dismissStyle(dismissProgress(dragY.value, height, m), m).uiOpacity
      : 1
  );

  const [pending, setPending] = useState<UserNav | null>(null);
  const busy = useRef(false);
  const latest = useRef({ nav, users, onNav });
  latest.current = { nav, users, onNav };

  // The new active page is rendered: drop the transition offset.
  useLayoutEffect(() => {
    offset.value = 0;
    fade.value = 0;
    fadeSide.value = 0;
    dragging.value = false;
    isTransitioning.value = false;
    busy.current = false;
  }, [nav.userIndex, offset, fade, fadeSide, dragging, isTransitioning]);

  const commit = useCallback((r: UserNav) => {
    setPending(null);
    latest.current.onNav(r);
  }, []);

  const commitSwipe = useCallback(
    (direction: 1 | -1) => {
      const c = latest.current;
      const r = swipeToUser(c.nav, direction, c.users, store);
      if (r?.kind === 'user') commit(r);
    },
    [store, commit]
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

  // Programmatic user change: animate once the target page is rendered.
  useEffect(() => {
    if (!pending) return;
    const done = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(commit, pending);
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
    offset,
    fade,
    fadeSide,
  ]);

  const hasPrev = nav.userIndex > 0;
  const hasNext = nav.userIndex < users.length - 1;
  const settleSpring: SpringConfig = {
    damping: m.cubeSettleDamping,
    stiffness: m.cubeSettleStiffness,
    mass: m.cubeSettleMass,
    overshootClamping: true,
  };
  const rubberSpring: SpringConfig = {
    damping: m.rubberBandDamping,
    stiffness: m.rubberBandStiffness,
    mass: m.rubberBandMass,
  };
  const snapSpring: SpringConfig = {
    damping: m.dismissSnapDamping,
    stiffness: m.dismissSnapStiffness,
    mass: m.dismissSnapMass,
  };

  const settle = (
    to: number,
    spring: SpringConfig,
    done: (finished?: boolean) => void
  ) => {
    'worklet';
    return reduced
      ? withTiming(to, { duration: m.reducedSpringMs }, done)
      : withSpring(to, spring, done);
  };
  const release = (finished?: boolean) => {
    'worklet';
    if (finished) dragging.value = false;
  };
  const startDrag = () => {
    'worklet';
    panIgnored.value = inputBlocked.value;
    if (!panIgnored.value) dragging.value = true;
    return !panIgnored.value;
  };
  const followX = (dx: number) => {
    'worklet';
    const open = dx < 0 ? hasNext : hasPrev;
    return open
      ? Math.max(-width, Math.min(width, dx))
      : rubberBand(dx, width, m.rubberBandFactor);
  };

  const panX = usePanGesture({
    testID: 'story-pan-x',
    activeOffsetX: [-m.panActiveOffsetX, m.panActiveOffsetX],
    failOffsetY: [-m.panFailOffsetY, m.panFailOffsetY],
    onActivate: (e) => {
      'worklet';
      if (startDrag()) offset.value = followX(e.translationX);
    },
    onUpdate: (e) => {
      'worklet';
      if (!panIgnored.value) offset.value = followX(e.translationX);
    },
    onDeactivate: (e) => {
      'worklet';
      if (panIgnored.value) return;
      const dir = e.canceled
        ? 0
        : swipeDecision(e.translationX, e.velocityX, width, m);
      if ((dir === 1 && hasNext) || (dir === -1 && hasPrev)) {
        isTransitioning.value = true;
        offset.value = settle(-dir * width, settleSpring, (finished) => {
          'worklet';
          if (finished) scheduleOnRN(commitSwipe, dir);
        });
        return;
      }
      const atEdge = e.translationX < 0 ? !hasNext : !hasPrev;
      offset.value = settle(0, atEdge ? rubberSpring : settleSpring, release);
    },
  });

  const panY = usePanGesture({
    testID: 'story-pan-y',
    activeOffsetY: [-m.dismissActiveOffsetY, m.dismissActiveOffsetY],
    onActivate: (e) => {
      'worklet';
      if (startDrag()) dragY.value = e.translationY;
    },
    onUpdate: (e) => {
      'worklet';
      if (!panIgnored.value) dragY.value = e.translationY;
    },
    onDeactivate: (e) => {
      'worklet';
      if (panIgnored.value) return;
      const dy = e.translationY;
      const vy = e.velocityY;
      if (!e.canceled && dy > 0 && shouldDismiss(dy, vy, m)) {
        // The viewer's close animation takes dragY back to 0.
        scheduleOnRN(requestClose);
        return;
      }
      if (!e.canceled && dy < 0 && shouldSwipeUp(dy, vy, m)) {
        scheduleOnRN(swipeUp);
      }
      dragY.value = settle(0, snapSpring, release);
    },
  });

  const pagerGesture = useCompetingGestures(panX, panY);

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
            role={role}
            offset={offset}
            fade={fade}
            fadeSide={fadeSide}
            hasPrev={hasPrev}
            hasNext={hasNext}
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
              inputBlocked={inputBlocked}
              pagerGesture={role === 0 ? pagerGesture : undefined}
              chromeOpacity={chromeOpacity}
              restartToken={role === 0 ? nav.restarts : 0}
              onNav={onPageNav}
              onMediaFirstFrame={onMediaFirstFrame}
            >
              {renderChrome(user, story, storyIndex)}
            </UserPage>
          </PagerSlot>
        );
      })}
    </>
  );
}

interface PagerSlotProps {
  testID: string;
  role: Role;
  offset: SharedValue<number>;
  fade: SharedValue<number>;
  fadeSide: SharedValue<Role>;
  hasPrev: boolean;
  hasNext: boolean;
  reduced: boolean;
  width: number;
  m: Motion;
  children: ReactNode;
}

/** Puts the page's layout offset right after the leading perspective. */
const place = (t: object[], translateX: number) => {
  'worklet';
  return [t[0]!, { translateX }, ...t.slice(1)];
};

function PagerSlot({
  testID,
  role,
  offset,
  fade,
  fadeSide,
  hasPrev,
  hasNext,
  reduced,
  width,
  m,
  children,
}: PagerSlotProps) {
  const style = useAnimatedStyle(() => {
    const x = offset.value;
    const crossfade = fadeSide.value !== 0;
    // Incoming user is on the side the finger drags toward; none at rest.
    const side = x < 0 ? 1 : x > 0 ? -1 : fadeSide.value;
    if (role === 0) {
      if (crossfade) {
        return { opacity: 1 - fade.value, transform: [{ translateX: 0 }] };
      }
      const hasIncoming = side === 1 ? hasNext : side === -1 ? hasPrev : false;
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
    const x = offset.value;
    if (role === 0 || reduced || x * role >= 0) return { opacity: 0 };
    return {
      opacity: cubeTransform(x / width, width, 'incoming', m.cubePerspective, m)
        .shadeOpacity,
    };
  });

  const active = role === 0;
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
