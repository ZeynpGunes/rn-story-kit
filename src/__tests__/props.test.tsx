import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { type ReactNode } from 'react';
import { Keyboard, Text, View } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import {
  StoryProvider,
  type StoryProviderProps,
} from '../provider/StoryProvider';
import { useStoryViewer } from '../provider/useStoryViewer';
import type { StoryItem, StoryUser } from '../types';

const mockInsets = { top: 0, bottom: 34, left: 0, right: 0 };
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context/jest/mock').default,
  useSafeAreaInsets: () => mockInsets,
}));

const { __players, __reset } = jest.requireMock('expo-video') as {
  __players: { muted: boolean; source: unknown }[];
  __reset(): void;
};

const img = (id: string, extra: Partial<StoryItem> = {}): StoryItem => ({
  id,
  type: 'image',
  uri: `https://x/${id}.jpg`,
  ...extra,
});
const vid = (id: string): StoryItem => ({
  id,
  type: 'video',
  uri: `https://x/${id}.mp4`,
});
const mk = (
  id: string,
  stories: StoryItem[],
  extra: Partial<StoryUser> = {}
): StoryUser => ({
  id,
  name: id,
  avatar: `https://x/${id}.jpg`,
  stories,
  ...extra,
});
const ada = mk('U1', [img('a1'), img('a2'), img('a3')], { data: { tier: 1 } });
const bob = mk('U2', [img('b1'), img('b2')]);

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
  props: Partial<StoryProviderProps> = {},
  users: StoryUser[] = [ada, bob],
  userId = 'U1'
) => {
  const utils = await render(
    <StoryProvider users={users} scheme="dark" {...props}>
      <Probe />
    </StoryProvider>
  );
  await act(async () => viewer.open(userId));
  await advance(400);
  return utils;
};
const display = async () => {
  await act(async () => {
    fireEvent(screen.getByTestId('story-image'), 'display');
  });
};
const uiOpacity = () =>
  (getAnimatedStyle as unknown as (e: unknown) => { opacity: number })(
    screen.getByTestId('story-ui')
  ).opacity;

beforeEach(() => {
  jest.useFakeTimers();
  __reset();
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('muted', () => {
  const clip = mk('V1', [vid('v1')]);
  it('defaults to unmuted', async () => {
    await open({}, [clip], 'V1');
    expect(__players.length).toBeGreaterThan(0);
    expect(__players.every((p) => !p.muted)).toBe(true);
  });
  it('mutes every player and follows the prop', async () => {
    const { rerender } = await open({ muted: true }, [clip], 'V1');
    expect(__players.every((p) => p.muted)).toBe(true);
    await act(async () =>
      rerender(
        <StoryProvider users={[clip]} scheme="dark" muted={false}>
          <Probe />
        </StoryProvider>
      )
    );
    expect(__players.every((p) => !p.muted)).toBe(true);
  });
});

describe('hideChrome', () => {
  it('shows the chrome by default', async () => {
    await open();
    expect(uiOpacity()).toBe(1);
    expect(screen.getByTestId('story-ui').props.pointerEvents).toBe('box-none');
  });
  it('hides it and blocks its touches while true, shows it again after', async () => {
    const { rerender } = await open({ hideChrome: true });
    await advance(400);
    expect(uiOpacity()).toBe(0);
    expect(screen.getByTestId('story-ui').props.pointerEvents).toBe('none');
    await act(async () =>
      rerender(
        <StoryProvider users={[ada, bob]} scheme="dark" hideChrome={false}>
          <Probe />
        </StoryProvider>
      )
    );
    await advance(400);
    expect(uiOpacity()).toBe(1);
    expect(screen.getByTestId('story-ui').props.pointerEvents).toBe('box-none');
  });
});

describe('renderContent', () => {
  it('replaces the media for a story that returns a node', async () => {
    const renderContent = jest.fn(
      (p: { story: StoryItem }): ReactNode | undefined =>
        p.story.id === 'a1' ? <Text>custom a1</Text> : undefined
    );
    await open({ renderContent });
    expect(screen.getByText('custom a1')).toBeTruthy();
    expect(screen.queryByTestId('story-image')).toBeNull();
    expect(renderContent).toHaveBeenCalledWith(
      expect.objectContaining({
        story: ada.stories[0],
        user: ada,
        storyIndex: 0,
        active: true,
      })
    );
  });
  it('counts as ready: progress runs, onStoryStart and onSeen fire', async () => {
    const onStoryStart = jest.fn();
    const onSeen = jest.fn();
    await open({
      renderContent: () => <Text>custom</Text>,
      onStoryStart,
      onSeen,
    });
    await advance(1000);
    expect(onStoryStart).toHaveBeenCalledTimes(1);
    expect(onSeen).toHaveBeenCalledWith('a1', 'U1');
    const fill = (
      getAnimatedStyle as unknown as (e: unknown) => { width: string }
    )(screen.getByTestId('story-progress-fill'));
    expect(fill.width).not.toBe('0%');
  });
  it('undefined keeps the built-in media', async () => {
    await open({ renderContent: () => undefined });
    expect(screen.getByTestId('story-image')).toBeTruthy();
  });
});

describe('renderMediaFrame', () => {
  function Frame({ children, id }: { children: ReactNode; id: string }) {
    return <View testID={`frame-${id}`}>{children}</View>;
  }
  it('wraps the media of the active page and its neighbours', async () => {
    const renderMediaFrame = jest.fn(
      (media: ReactNode, p: { user: StoryUser }) => (
        <Frame id={p.user.id}>{media}</Frame>
      )
    );
    await open({ renderMediaFrame });
    expect(screen.getByTestId('frame-U1')).toBeTruthy();
    expect(
      screen.getByTestId('frame-U2', { includeHiddenElements: true })
    ).toBeTruthy();
    expect(renderMediaFrame).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ user: ada, active: true })
    );
    expect(renderMediaFrame).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ user: bob, active: false })
    );
  });
});

describe('onStoryChange and onStoryStart', () => {
  it('onStoryChange fires on open, on a story change and on a user change', async () => {
    const onStoryChange = jest.fn();
    await open({ onStoryChange });
    expect(onStoryChange).toHaveBeenCalledTimes(1);
    expect(onStoryChange).toHaveBeenLastCalledWith(ada.stories[0], ada, 0);
    await act(async () => viewer.next());
    await advance(50);
    expect(onStoryChange).toHaveBeenLastCalledWith(ada.stories[1], ada, 1);
    await act(async () => viewer.goToUser('U2'));
    await advance(1000);
    expect(onStoryChange).toHaveBeenLastCalledWith(bob.stories[0], bob, 0);
    expect(onStoryChange).toHaveBeenCalledTimes(3);
  });
  it('onStoryStart fires on the first frame, again for a re-viewed story', async () => {
    const onStoryStart = jest.fn();
    await open({ onStoryStart, initialSeen: ['a1'] });
    expect(onStoryStart).not.toHaveBeenCalled();
    await display();
    expect(onStoryStart).toHaveBeenCalledTimes(1);
    expect(onStoryStart).toHaveBeenLastCalledWith(ada.stories[1], ada, 1);
    await act(async () => viewer.prev());
    await advance(50);
    await display();
    expect(onStoryStart).toHaveBeenCalledTimes(2);
    expect(onStoryStart).toHaveBeenLastCalledWith(ada.stories[0], ada, 0);
    await act(async () => viewer.next());
    await advance(50);
    await act(async () => viewer.prev());
    await advance(50);
    await display();
    expect(onStoryStart).toHaveBeenCalledTimes(3);
  });
});

describe('StoryUser', () => {
  it('data reaches the callbacks untouched', async () => {
    const onStoryChange = jest.fn();
    await open({ onStoryChange });
    expect(onStoryChange.mock.calls[0]![1].data).toBe(ada.data);
  });
  it('startIndex opens at that story', async () => {
    const onStoryChange = jest.fn();
    const withStart = { ...ada, startIndex: 2 };
    await open({ onStoryChange }, [withStart, bob]);
    expect(onStoryChange).toHaveBeenLastCalledWith(
      withStart.stories[2],
      withStart,
      2
    );
    expect(screen.getByLabelText('Story 3 of 3')).toBeTruthy();
  });
});

describe('scrims', () => {
  const withFooter = { renderFooter: () => <Text>f</Text> };
  it('draws the top and bottom scrims by default', async () => {
    await open(withFooter);
    expect(screen.getAllByTestId('story-scrim-top').length).toBeGreaterThan(0);
    expect(screen.getByTestId('story-scrim-bottom')).toBeTruthy();
  });
  it('scrims false draws neither', async () => {
    await open({ ...withFooter, config: { scrims: false } });
    expect(screen.queryAllByTestId('story-scrim-top')).toHaveLength(0);
    expect(screen.queryByTestId('story-scrim-bottom')).toBeNull();
  });
});

describe('footer config', () => {
  const footer = () => screen.getByTestId('story-footer');
  const withActions = { renderFooter: () => <Text>f</Text> };
  const paddingBottom = () =>
    (
      Object.assign({}, ...[footer().props.style].flat(3)) as {
        paddingBottom: number;
      }
    ).paddingBottom;

  it('pads by the safe-area inset by default', async () => {
    await open(withActions);
    expect(paddingBottom()).toBe(34);
  });
  it('footerSafeAreaInset false removes the padding', async () => {
    await open({ ...withActions, config: { footerSafeAreaInset: false } });
    expect(paddingBottom()).toBe(0);
  });

  const lift = () =>
    (
      getAnimatedStyle as unknown as (e: unknown) => {
        transform: { translateY: number }[];
      }
    )(footer()).transform[0]!.translateY;

  it('footerKeyboardAvoiding lifts the footer with the keyboard', async () => {
    const listeners: Record<string, (e: unknown) => void> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((
      name: string,
      fn: (e: unknown) => void
    ) => {
      listeners[name] = fn;
      return { remove: jest.fn() };
    }) as never);
    await open({ ...withActions, config: { footerKeyboardAvoiding: true } });
    expect(lift()).toBeCloseTo(0);
    const [show, hide] = Object.keys(listeners);
    await act(async () => {
      listeners[show!]!({ endCoordinates: { height: 300 }, duration: 100 });
    });
    await advance(200);
    // The 34px safe-area padding already sits under the keyboard.
    expect(lift()).toBeCloseTo(-266);
    await act(async () => {
      listeners[hide!]!({ endCoordinates: { height: 0 }, duration: 100 });
    });
    await advance(200);
    expect(lift()).toBeCloseTo(0);
  });
  it('does not listen to the keyboard by default', async () => {
    const add = jest.spyOn(Keyboard, 'addListener');
    await open(withActions);
    expect(add).not.toHaveBeenCalled();
  });
});

describe('safe-area layout', () => {
  afterEach(() => {
    mockInsets.top = 0;
  });
  const frame = () => <View testID="frame" />;
  const frameStyles = () => {
    const out: string[] = [];
    let n = screen.getByTestId('frame').parent;
    while (n && n.props.testID !== 'story-tap-area') {
      out.push(JSON.stringify(n.props.style ?? null));
      n = n.parent;
    }
    return out.join('|');
  };

  it('slot props carry the insets and the y below the progress bar', async () => {
    mockInsets.top = 47;
    const renderHeader = jest.fn(() => null);
    await open({ renderHeader });
    const p = (
      renderHeader.mock.calls as unknown as [Record<string, unknown>][]
    )[0]![0];
    expect(p.insets).toEqual({ top: 47, bottom: 34 });
    // 47 + progress.topInset (8) + progress.height
    expect(p.headerTop).toBeGreaterThan(55);
  });
  it('mediaSafeAreaTop starts the media frame below the top inset', async () => {
    mockInsets.top = 47;
    await open({
      config: { mediaSafeAreaTop: true },
      renderMediaFrame: frame,
    });
    expect(frameStyles()).toContain('"marginTop":47');
  });
  it('is full-bleed by default', async () => {
    mockInsets.top = 47;
    await open({ renderMediaFrame: frame });
    expect(frameStyles()).not.toContain('marginTop');
  });
});
