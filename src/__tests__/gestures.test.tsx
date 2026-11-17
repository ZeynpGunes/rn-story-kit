import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import { useState, type ReactNode } from 'react';
import { Dimensions, Text } from 'react-native';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';
import { Easing, getAnimatedStyle } from 'react-native-reanimated';
import { defaultConfig } from '../config';
import { StoryList } from '../list/StoryList';
import {
  dismissProgress,
  dismissStyle,
  rubberBand,
} from '../model/gestureMath';
import * as navigation from '../model/navigation';
import { StoryProvider, type StorySlotProps } from '../provider/StoryProvider';
import { useStoryViewer } from '../provider/useStoryViewer';
import type { StoryItem, StoryUser } from '../types';

const mockReduced = { value: false };
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual('react-native-reanimated'),
  useReducedMotion: () => mockReduced.value,
}));

// The thresholds in the task brief assume a phone-sized window.
const WIDTH = 375;
const HEIGHT = 812;
const m = defaultConfig.motion;

const img = (id: string, seen = false): StoryItem => ({
  id,
  type: 'image',
  uri: `https://x/${id}.jpg`,
  seen,
});
const mk = (id: string, name: string, stories: StoryItem[]): StoryUser => ({
  id,
  name,
  avatar: `https://x/${id}.jpg`,
  stories,
});
const U0 = mk('U0', 'Ada', [img('a1'), img('a2')]);
const U1 = mk('U1', 'Bob', [img('b1', true), img('b2'), img('b3')]);
const U2 = mk('U2', 'Cy', [img('c1')]);
const U3 = mk('U3', 'Dee', [img('d1')]);
const users = [U0, U1, U2, U3];

let viewer: ReturnType<typeof useStoryViewer>;
function Probe() {
  viewer = useStoryViewer();
  return null;
}

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

const open = async (
  userId: string,
  props: Record<string, unknown> = {},
  extra: ReactNode = null
) => {
  await render(
    <StoryProvider users={users} scheme="dark" {...props}>
      <Probe />
      {extra}
    </StoryProvider>
  );
  await act(async () => viewer.open(userId));
  await advance(400);
};

type Style = Record<string, unknown> & { transform?: object[] };
const styleOf = (testID: string): Style =>
  (getAnimatedStyle as unknown as (e: unknown) => Style)(
    screen.getByTestId(testID, { includeHiddenElements: true })
  );
const transformOf = (testID: string) =>
  Object.assign({}, ...(styleOf(testID).transform ?? [])) as Record<
    string,
    unknown
  >;
const hasRotate = (testID: string) =>
  (styleOf(testID).transform ?? []).some((t) => 'rotateY' in t);
const pageId = (id: string) => `story-page-${id}`;
const pageExists = (id: string) =>
  screen.queryByTestId(pageId(id), { includeHiddenElements: true }) !== null;

/** Active page: the only page exposed to accessibility. */
const expectActive = (name: string, label: string) => {
  expect(screen.getByText(name)).toBeTruthy();
  expect(screen.getByLabelText(label)).toBeTruthy();
};

const display = async () => {
  await act(async () => {
    fireEvent(screen.getByTestId('story-image'), 'display');
  });
};
const fillWidth = () =>
  (getAnimatedStyle as unknown as (e: unknown) => { width: string })(
    screen.getByTestId('story-progress-fill')
  ).width;

const startPan = async (id: 'story-pan-x' | 'story-pan-y', d: number) => {
  const pan = createGestureController(id);
  const key = id === 'story-pan-x' ? 'translationX' : 'translationY';
  const vKey = id === 'story-pan-x' ? 'velocityX' : 'velocityY';
  await act(async () => {
    pan.begin();
    pan.activate({ [key]: Math.sign(d) * 13, [vKey]: 0 });
    pan.update({ [key]: d, [vKey]: 0 });
  });
  return {
    pan,
    end: async (v = 0) => {
      await act(async () => {
        pan.end({ [key]: d, [vKey]: v });
      });
    },
  };
};
const pan = async (id: 'story-pan-x' | 'story-pan-y', d: number, v = 0) => {
  const p = await startPan(id, d);
  await p.end(v);
};

const tapRight = async () => {
  const tap = createGestureController('story-tap');
  await act(async () => {
    tap.begin();
    tap.activate({ x: WIDTH * 0.9 });
    tap.end();
  });
};

let savedWindow: ReturnType<typeof Dimensions.get>;
beforeAll(() => {
  savedWindow = Dimensions.get('window');
  Dimensions.set({
    window: { width: WIDTH, height: HEIGHT, scale: 2, fontScale: 1 },
  });
});
afterAll(() => Dimensions.set({ window: savedWindow }));
beforeEach(() => {
  mockReduced.value = false;
  jest.useFakeTimers();
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('horizontal swipe', () => {
  it('dx -140 on U0 settles on U1 at its first unseen story', async () => {
    const onClose = jest.fn();
    await open('U0', { onClose });
    expectActive('Ada', 'Story 1 of 2');
    await pan('story-pan-x', -140);
    await advance(1000);
    expectActive('Bob', 'Story 2 of 3');
    expect(screen.queryByText('Ada')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('dx -100, vx 0 springs back to U0 and progress resumes', async () => {
    await open('U0');
    await display();
    await advance(1000);
    const p = await startPan('story-pan-x', -100);
    await advance(100);
    const frozen = fillWidth();
    expect(frozen).not.toBe('0%');
    await advance(3000);
    expect(fillWidth()).toBe(frozen);
    await p.end(0);
    await advance(1000);
    expectActive('Ada', 'Story 1 of 2');
    expect(transformOf(pageId('U0')).translateX ?? 0).toBeCloseTo(0);
    await advance(500);
    expect(fillWidth()).not.toBe(frozen);
  });

  it('renders the neighbour on the drag side and hides the other', async () => {
    await open('U1');
    const p = await startPan('story-pan-x', -100);
    expect(styleOf(pageId('U2')).opacity).toBe(1);
    expect(styleOf(pageId('U0')).opacity).toBe(0);
    await p.end(0);
    await advance(1000);
    expect(styleOf(pageId('U2')).opacity).toBe(0);
    expect(styleOf(pageId('U0')).opacity).toBe(0);
  });

  it('dx +140 on the first user rubber-bands and neither moves nor closes', async () => {
    const onClose = jest.fn();
    await open('U0', { onClose });
    const p = await startPan('story-pan-x', 140);
    expect(transformOf(pageId('U0')).translateX).toBeCloseTo(
      rubberBand(140, WIDTH)
    );
    await p.end(0);
    await advance(1500);
    expectActive('Ada', 'Story 1 of 2');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('story-viewer')).toBeTruthy();
  });

  it('dx -140 on the last user does not close', async () => {
    const onClose = jest.fn();
    await open('U3', { onClose });
    await pan('story-pan-x', -140, -900);
    await advance(1500);
    expectActive('Dee', 'Story 1 of 1');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('story-viewer')).toBeTruthy();
  });

  it('mounts only active-1, active and active+1 pages', async () => {
    await open('U0');
    expect(['U0', 'U1', 'U2', 'U3'].map(pageExists)).toEqual([
      true,
      true,
      false,
      false,
    ]);
    await pan('story-pan-x', -140);
    await advance(1000);
    expect(['U0', 'U1', 'U2', 'U3'].map(pageExists)).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it('the hidden source bubble follows the active user', async () => {
    await open('U0', {}, <StoryList />);
    const opacityOf = (id: string) =>
      Object.assign(
        {},
        ...[
          screen.getByTestId(`bubble-${id}`, { includeHiddenElements: true })
            .props.style,
        ].flat(2)
      ).opacity;
    expect(opacityOf('U0')).toBe(0);
    await pan('story-pan-x', -140);
    await advance(1000);
    expect(opacityOf('U1')).toBe(0);
    expect(opacityOf('U0')).not.toBe(0);
  });
});

describe('transition hand-over', () => {
  it('a committed swipe switches roles on the UI thread before React commits', async () => {
    await open('U0');
    const p = await startPan('story-pan-x', -140);
    let seen: { u1: Style; u0: Style; bob: boolean } | null = null;
    await act(async () => {
      p.pan.end({ translationX: -140, velocityX: 0 });
      jest.advanceTimersByTime(1000);
      // Still inside act: no React render or effect has run yet.
      seen = {
        u1: styleOf(pageId('U1')),
        u0: styleOf(pageId('U0')),
        bob: screen.queryByText('Bob') !== null,
      };
    });
    const { u1, u0, bob } = seen!;
    expect(bob).toBe(false);
    expect(u1.opacity).toBe(1);
    expect((u1.transform ?? []).some((t) => 'rotateY' in t)).toBe(false);
    expect(
      (Object.assign({}, ...(u1.transform ?? [])) as { translateX: number })
        .translateX
    ).toBeCloseTo(0);
    expect(u0.opacity).toBe(0);
    expectActive('Bob', 'Story 2 of 3');
  });

  it('closing during a transition keeps the active user', async () => {
    const onClose = jest.fn();
    await open('U0', { onClose }, <StoryList />);
    const opacityOf = (id: string) =>
      Object.assign(
        {},
        ...[
          screen.getByTestId(`bubble-${id}`, { includeHiddenElements: true })
            .props.style,
        ].flat(2)
      ).opacity;
    await tapRight();
    await advance(50);
    await tapRight();
    await advance(50);
    await advance(100); // mid-cube
    await fireEvent.press(screen.getByLabelText('Close stories'));
    await advance(250); // the cube would have finished by now
    expect(screen.getByTestId('story-viewer')).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(opacityOf('U0')).toBe(0);
    expect(opacityOf('U1')).not.toBe(0);
    await advance(1);
    await advance(500);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a swipe whose target vanished resets and keeps input working', async () => {
    jest.spyOn(navigation, 'swipeToUser').mockReturnValueOnce(null);
    await open('U0');
    await pan('story-pan-x', -140);
    await advance(1000);
    expectActive('Ada', 'Story 1 of 2');
    expect(styleOf(pageId('U0')).opacity).toBe(1);
    expect(transformOf(pageId('U0')).translateX).toBeCloseTo(0);
    expect(styleOf(pageId('U1')).opacity).toBe(0);
    await tapRight();
    await advance(50);
    expectActive('Ada', 'Story 2 of 2');
  });

  it('extra taps during the hop and the cube neither restart nor chain it', async () => {
    const run = async (extraTaps: boolean) => {
      await open('U0');
      await tapRight();
      await advance(50);
      // Each programmatic cube start builds its easing once.
      const cubeStarts = jest.spyOn(Easing, 'bezier');
      await tapRight(); // last story: user change requested
      if (extraTaps) await tapRight(); // during the scheduleOnRN hop
      await advance(50);
      if (extraTaps) await tapRight(); // during the cube
      const samples: unknown[] = [];
      for (let i = 0; i < 10; i++) {
        await advance(40);
        const bob = screen.queryByText('Bob') !== null;
        samples.push([
          bob,
          // Layout offset of the incoming face (after the perspective).
          bob ? null : styleOf(pageId('U1')).transform?.[1],
        ]);
        if (!bob) expect(pageExists('U2')).toBe(false);
      }
      expectActive('Bob', 'Story 1 of 3');
      const starts = cubeStarts.mock.calls.length;
      cubeStarts.mockRestore();
      await cleanup();
      return { samples, starts };
    };
    const single = await run(false);
    const tapped = await run(true);
    expect(single.starts).toBe(1);
    expect(tapped.starts).toBe(1);
    expect(tapped.samples).toEqual(single.samples);
  });
});

describe('custom header', () => {
  it('renders only for the active page and keeps its hooks across a user change', async () => {
    const calls: string[] = [];
    function HeaderProbe(p: StorySlotProps) {
      const [n] = useState(1);
      calls.push(p.user.id);
      return <Text>{`hdr ${p.user.name} ${n}`}</Text>;
    }
    await open('U0', { renderHeader: HeaderProbe });
    expect(new Set(calls)).toEqual(new Set(['U0']));
    expect(
      screen.queryByText('hdr Bob 1', { includeHiddenElements: true })
    ).toBeNull();
    await pan('story-pan-x', -140);
    await advance(1000);
    expect(screen.getByText('hdr Bob 1')).toBeTruthy();
    expect(calls).not.toContain('U2');
    expect(
      screen.queryByText('hdr Cy 1', { includeHiddenElements: true })
    ).toBeNull();
  });
});

describe('config tapZoneRatio', () => {
  it('0.5 makes x = 0.45 go to the previous story', async () => {
    await open('U0', { config: { tapZoneRatio: 0.5 } });
    await tapRight(); // a1 -> a2
    await advance(50);
    expectActive('Ada', 'Story 2 of 2');
    const tap = createGestureController('story-tap');
    await act(async () => {
      tap.begin();
      tap.activate({ x: WIDTH * 0.45 });
      tap.end();
    });
    await advance(50);
    expectActive('Ada', 'Story 1 of 2');
  });
});

describe('programmatic user change', () => {
  it('two taps 50ms apart on the last story land on U1 story 0', async () => {
    await open('U0');
    await tapRight(); // a1 -> a2
    await advance(50);
    expectActive('Ada', 'Story 2 of 2');
    await tapRight();
    await advance(50); // tap hop, then the 320ms transition starts
    await tapRight(); // ignored while the transition runs
    await advance(50);
    await advance(400);
    expectActive('Bob', 'Story 1 of 3');
    await advance(1000);
    expectActive('Bob', 'Story 1 of 3');
  });

  it('runs the cube for 320ms before switching the user', async () => {
    await open('U0');
    await tapRight();
    await advance(50);
    await tapRight();
    await advance(50); // tap hop, then the transition starts
    await advance(150);
    expectActive('Ada', 'Story 2 of 2');
    expect(hasRotate(pageId('U1'))).toBe(true);
    expect(styleOf(pageId('U1')).opacity).toBe(1);
    await advance(250);
    expectActive('Bob', 'Story 1 of 3');
  });
});

describe('vertical gestures', () => {
  it('dy 130 closes, onClose once', async () => {
    const onClose = jest.fn();
    await open('U0', { onClose });
    await pan('story-pan-y', 130);
    await advance(200); // scheduleOnRN hop, bubble measure times out
    await advance(1);
    await advance(400);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('story-viewer')).toBeNull();
  });

  it('dy 60, vy 0 follows the finger, springs back and resumes', async () => {
    const onClose = jest.fn();
    await open('U0', { onClose });
    await display();
    await advance(1000);
    const p = await startPan('story-pan-y', 60);
    const d = dismissStyle(dismissProgress(60, HEIGHT));
    expect(transformOf('story-viewer').translateY).toBeCloseTo(60);
    expect(transformOf('story-viewer').scale).toBeCloseTo(d.scale);
    expect(styleOf('story-backdrop').opacity).toBeCloseTo(d.bgOpacity);
    await advance(100);
    const frozen = fillWidth();
    await advance(3000);
    expect(fillWidth()).toBe(frozen);
    await p.end(0);
    await advance(1000);
    expect(onClose).not.toHaveBeenCalled();
    expect(transformOf('story-viewer').translateY).toBeCloseTo(0);
    expect(transformOf('story-viewer').scale).toBeCloseTo(1);
    await advance(500);
    expect(fillWidth()).not.toBe(frozen);
  });

  it('dy -90 calls onSwipeUp(story, user) and does not close', async () => {
    const onSwipeUp = jest.fn();
    const onClose = jest.fn();
    await open('U0', { onSwipeUp, onClose });
    const p = await startPan('story-pan-y', -90);
    expect(transformOf('story-viewer').translateY).toBeGreaterThanOrEqual(
      -m.swipeUpFollowMax
    );
    await p.end(0);
    await advance(1000);
    expect(onSwipeUp).toHaveBeenCalledTimes(1);
    expect(onSwipeUp).toHaveBeenCalledWith(U0.stories[0], U0);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('story-viewer')).toBeTruthy();
  });
});

describe('reduce motion', () => {
  it('user change crossfades without rotateY; dismiss keeps scale 1', async () => {
    mockReduced.value = true;
    await open('U0');
    await tapRight();
    await advance(50);
    await tapRight();
    await advance(50);
    await advance(100);
    const incoming = styleOf(pageId('U1')).opacity as number;
    expect(incoming).toBeGreaterThan(0);
    expect(incoming).toBeLessThan(1);
    expect(hasRotate(pageId('U1'))).toBe(false);
    expect(hasRotate(pageId('U0'))).toBe(false);
    await advance(400);
    expectActive('Bob', 'Story 1 of 3');

    const drag = await startPan('story-pan-x', -100);
    expect(hasRotate(pageId('U1'))).toBe(false);
    expect(hasRotate(pageId('U2'))).toBe(false);
    await drag.end(0);
    await advance(500);

    const p = await startPan('story-pan-y', 60);
    expect(transformOf('story-viewer').scale ?? 1).toBe(1);
    expect(styleOf('story-backdrop').opacity).toBeCloseTo(
      1 - dismissProgress(60, HEIGHT)
    );
    await p.end(0);
  });
});
