import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Image } from 'expo-image';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';
import {
  getAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { enterUser, tapNext } from '../model/navigation';
import { StoryProvider, useStoryContext } from '../provider/StoryProvider';
import type { StoryItem, StoryUser } from '../types';
import {
  nextVideoTarget,
  preloadTargets,
  usePreload,
} from '../viewer/media/preload';
import { VideoSlotsProvider } from '../viewer/media/videoSlots';
import { UserPage, type UserPageProps } from '../viewer/UserPage';

const { __players, __reset } = jest.requireMock('expo-video') as {
  __players: MockPlayer[];
  __reset(): void;
};
interface MockPlayer {
  source: unknown;
  playing: boolean;
  replace: jest.Mock;
  play: jest.Mock;
  pause: jest.Mock;
  emit(event: string, payload?: unknown): void;
}

const vid = (id: string, extra: Partial<StoryItem> = {}): StoryItem => ({
  id,
  type: 'video',
  uri: `https://x/${id}.mp4`,
  ...extra,
});
const img = (id: string): StoryItem => ({
  id,
  type: 'image',
  uri: `https://x/${id}.jpg`,
});
const user = (id: string, stories: StoryItem[]): StoryUser => ({
  id,
  name: id,
  avatar: 'https://x/a.jpg',
  stories,
});
const ada = user('U1', [vid('v1'), vid('v2'), img('i3')]);
const bob = user('U2', [vid('b1')]);
const cy = user('U3', [img('c1')]);
const users = [ada, bob, cy];

let heldSv: SharedValue<boolean>;
function Page(p: Partial<UserPageProps>) {
  heldSv = useSharedValue(false);
  return (
    <UserPage
      user={ada}
      storyIndex={0}
      users={users}
      lastViewed={{}}
      isActive
      held={heldSv}
      onNav={() => {}}
      onMediaFirstFrame={() => {}}
      {...p}
    />
  );
}
const mount = async (p: Partial<UserPageProps> = {}, next?: StoryItem) =>
  await render(
    <StoryProvider users={users} scheme="dark">
      <VideoSlotsProvider active={ada.stories[0]} next={next}>
        <Page {...p} />
      </VideoSlotsProvider>
    </StoryProvider>
  );

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};
const playerFor = (s: StoryItem) => {
  const p = __players.find((x) => x.source === s.uri);
  if (!p) throw new Error(`no player for ${s.id}`);
  return p;
};
const emit = async (s: StoryItem, event: string, payload?: unknown) => {
  await act(async () => {
    playerFor(s).emit(event, payload);
  });
};
const firstFrame = async () => {
  await act(async () => {
    fireEvent(screen.getByTestId('story-video'), 'firstFrameRender');
  });
};
const fillWidth = () =>
  (getAnimatedStyle as unknown as (e: unknown) => { width: string })(
    screen.getByTestId('story-progress-fill')
  ).width;

beforeEach(() => {
  jest.useFakeTimers();
  __reset();
  (Image.prefetch as jest.Mock).mockClear();
});
afterEach(() => jest.useRealTimers());

const v1 = ada.stories[0]!;
const v2 = ada.stories[1]!;
const state = { userIndex: 0, storyIndex: 0 };

describe('video timer', () => {
  it('advanceBlocked keeps playing and runs progress out without advancing', async () => {
    const onNav = jest.fn();
    let blocked: SharedValue<boolean>;
    function Blocked() {
      blocked = useSharedValue(true);
      return <Page onNav={onNav} advanceBlocked={blocked} />;
    }
    await render(
      <StoryProvider users={users} scheme="dark">
        <VideoSlotsProvider active={ada.stories[0]} next={undefined}>
          <Blocked />
        </VideoSlotsProvider>
      </StoryProvider>
    );
    await emit(v1, 'sourceLoad', { duration: 2 });
    await firstFrame();
    await advance(2500);
    expect(fillWidth()).toBe('100%');
    expect(playerFor(v1).playing).toBe(true);
    expect(onNav).not.toHaveBeenCalled();
  });

  it('uses the sourceLoad duration (7300ms)', async () => {
    const onNav = jest.fn();
    await mount({ onNav });
    await emit(v1, 'sourceLoad', { duration: 7.3 });
    await firstFrame();
    await advance(7200);
    expect(onNav).not.toHaveBeenCalled();
    await advance(200);
    expect(onNav).toHaveBeenCalledWith(tapNext(state, users));
  });

  it('story.durationMs overrides the video length', async () => {
    const onNav = jest.fn();
    const short = user('U1', [vid('v1', { durationMs: 2000 })]);
    await mount({ onNav, user: short, users: [short] });
    await emit(short.stories[0]!, 'sourceLoad', { duration: 30 });
    await firstFrame();
    await advance(2100);
    expect(onNav).toHaveBeenCalled();
  });

  it('waits for both duration and first frame', async () => {
    const onNav = jest.fn();
    await mount({ onNav });
    await firstFrame();
    await advance(10000);
    expect(fillWidth()).toBe('0%');
    await emit(v1, 'sourceLoad', { duration: 1 });
    await advance(1100);
    expect(onNav).toHaveBeenCalledTimes(1);
  });

  it('freezes while buffering and resumes on readyToPlay', async () => {
    const onNav = jest.fn();
    await mount({ onNav });
    await emit(v1, 'sourceLoad', { duration: 4 });
    await emit(v1, 'statusChange', { status: 'readyToPlay' });
    await firstFrame();
    await advance(1000);
    await emit(v1, 'statusChange', { status: 'loading' });
    await advance(50);
    const frozen = fillWidth();
    expect(frozen).not.toBe('0%');
    await advance(10000);
    expect(fillWidth()).toBe(frozen);
    expect(playerFor(v1).pause).toHaveBeenCalled();
    await emit(v1, 'statusChange', { status: 'readyToPlay' });
    await advance(2800);
    expect(onNav).not.toHaveBeenCalled();
    await advance(300);
    expect(onNav).toHaveBeenCalledTimes(1);
  });
});

describe('video thumb and playback', () => {
  it('keeps the thumb until first frame, then fades out over 180ms', async () => {
    await mount();
    expect(screen.getByTestId('story-video-thumb')).toBeTruthy();
    await advance(1000);
    expect(screen.getByTestId('story-video-thumb')).toBeTruthy();
    await firstFrame();
    await advance(100);
    expect(screen.getByTestId('story-video-thumb')).toBeTruthy();
    await advance(100);
    expect(screen.queryByTestId('story-video-thumb')).toBeNull();
  });

  it('plays, pauses on long-press, plays again on release', async () => {
    await mount();
    const p = playerFor(v1);
    expect(p.play).toHaveBeenCalled();
    const press = createGestureController('story-long-press');
    await act(async () => {
      press.begin();
      press.activate();
    });
    await advance(50);
    expect(p.pause).toHaveBeenCalled();
    p.play.mockClear();
    await act(async () => {
      press.end();
    });
    await advance(50);
    expect(p.play).toHaveBeenCalled();
  });

  it('pauses while the parent held value is true', async () => {
    await mount();
    const p = playerFor(v1);
    await act(async () => {
      heldSv.value = true;
    });
    await advance(50);
    expect(p.pause).toHaveBeenCalled();
  });

  it('marks seen on first frame only', async () => {
    const onMediaFirstFrame = jest.fn();
    await mount({ onMediaFirstFrame });
    await emit(v1, 'sourceLoad', { duration: 3 });
    expect(onMediaFirstFrame).not.toHaveBeenCalled();
    await firstFrame();
    expect(onMediaFirstFrame).toHaveBeenCalledWith(v1);
  });

  it('on player error advances after 4000ms and never marks seen', async () => {
    const onNav = jest.fn();
    const onMediaFirstFrame = jest.fn();
    await mount({ onNav, onMediaFirstFrame });
    await emit(v1, 'statusChange', { status: 'error' });
    await advance(3900);
    expect(onNav).not.toHaveBeenCalled();
    await advance(200);
    expect(onNav).toHaveBeenCalledWith(tapNext(state, users));
    expect(onMediaFirstFrame).not.toHaveBeenCalled();
  });
});

describe('config mediaErrorAdvanceMs', () => {
  it('1000 advances after an error at 1000ms', async () => {
    const onNav = jest.fn();
    await render(
      <StoryProvider
        users={users}
        scheme="dark"
        config={{ mediaErrorAdvanceMs: 1000 }}
      >
        <VideoSlotsProvider active={ada.stories[0]} next={undefined}>
          <Page onNav={onNav} />
        </VideoSlotsProvider>
      </StoryProvider>
    );
    await emit(v1, 'statusChange', { status: 'error' });
    await advance(900);
    expect(onNav).not.toHaveBeenCalled();
    await advance(200);
    expect(onNav).toHaveBeenCalledWith(tapNext(state, users));
  });
});

describe('player cap', () => {
  it('creates at most 2 players with 3 user pages mounted', async () => {
    await render(
      <StoryProvider users={users} scheme="dark">
        <VideoSlotsProvider active={v1} next={v2}>
          {users.map((u, i) => (
            <Page key={u.id} user={u} isActive={i === 0} />
          ))}
        </VideoSlotsProvider>
      </StoryProvider>
    );
    expect(__players).toHaveLength(2);
    expect(screen.getAllByTestId('story-video')).toHaveLength(1);
    expect(screen.getAllByTestId('story-video-thumb').length).toBeGreaterThan(
      0
    );
    expect(playerFor(v1)).toBeTruthy();
    expect(playerFor(v2)).toBeTruthy();
  });

  it('reuses the preloaded player when the next story becomes active', async () => {
    const view = (active: StoryItem, next?: StoryItem) => (
      <StoryProvider users={users} scheme="dark">
        <VideoSlotsProvider active={active} next={next}>
          <Page storyIndex={active === v1 ? 0 : 1} />
        </VideoSlotsProvider>
      </StoryProvider>
    );
    const r = await render(view(v1, v2));
    const preloaded = playerFor(v2);
    await r.rerender(view(v2, undefined));
    expect(__players).toHaveLength(2);
    expect(playerFor(v2)).toBe(preloaded);
  });
});

describe('slot lifecycle', () => {
  const dan = user('U1', [vid('v1'), vid('v2'), img('i3')]);
  const i3 = dan.stories[2]!;
  const view = (storyIndex: number, active: StoryItem, next?: StoryItem) => (
    <StoryProvider users={[dan]} scheme="dark">
      <VideoSlotsProvider active={active} next={next}>
        <Page user={dan} users={[dan]} storyIndex={storyIndex} />
      </VideoSlotsProvider>
    </StoryProvider>
  );
  const playingCount = () => __players.filter((p) => p.playing).length;

  it('pauses and clears freed players: v1 -> v2 -> i3', async () => {
    const r = await render(view(0, v1, v2));
    const p1 = playerFor(v1);
    const p2 = playerFor(v2);
    expect(playingCount()).toBeLessThanOrEqual(1);
    await r.rerender(view(1, v2, undefined));
    await advance(50);
    expect(p1.pause).toHaveBeenCalled();
    expect(p1.replace).toHaveBeenLastCalledWith(null);
    expect(playingCount()).toBeLessThanOrEqual(1);
    await r.rerender(view(2, i3, undefined));
    await advance(50);
    expect(p2.pause).toHaveBeenCalled();
    expect(p2.replace).toHaveBeenLastCalledWith(null);
    expect(playingCount()).toBe(0);
  });

  it('ignores a recycled slot stale status until its own sourceLoad', async () => {
    const v3 = vid('v3');
    const two = user('U1', [v1, v3]);
    const onNav = jest.fn();
    const render2 = (idx: number, active: StoryItem) => (
      <StoryProvider users={[two]} scheme="dark">
        <VideoSlotsProvider active={active} next={undefined}>
          <Page user={two} users={[two]} storyIndex={idx} onNav={onNav} />
        </VideoSlotsProvider>
      </StoryProvider>
    );
    const r = await render(render2(0, v1));
    const slot = playerFor(v1) as MockPlayer & {
      status: string;
      duration: number;
    };
    await emit(v1, 'sourceLoad', { duration: 7.3 });
    slot.status = 'readyToPlay';
    slot.duration = 7.3;
    await r.rerender(render2(1, v3));
    await advance(50);
    expect(playerFor(v3)).toBe(slot);
    await firstFrame();
    await advance(10000);
    expect(onNav).not.toHaveBeenCalled();
    expect(fillWidth()).toBe('0%');
    await emit(v3, 'sourceLoad', { duration: 3 });
    await advance(2900);
    expect(onNav).not.toHaveBeenCalled();
    await advance(200);
    expect(onNav).toHaveBeenCalledTimes(1);
  });
});

describe('usePreload', () => {
  it('preloads the next user entry video when the next story is an image', async () => {
    const mixed = user('U1', [vid('m1'), img('m2')]);
    const nxt = user('U2', [vid('n1')]);
    function Probe() {
      const { store } = useStoryContext();
      const t = preloadTargets(
        [mixed, nxt],
        { userIndex: 0, storyIndex: 0 },
        store
      );
      return (
        <VideoSlotsProvider active={undefined} next={nextVideoTarget(t)} />
      );
    }
    await render(
      <StoryProvider users={[mixed, nxt]} scheme="dark">
        <Probe />
      </StoryProvider>
    );
    expect(playerFor(nxt.stories[0]!)).toBeTruthy();
  });

  function Harness({
    nav,
  }: {
    nav: { userIndex: number; storyIndex: number };
  }) {
    usePreload(users, nav);
    return null;
  }
  const prefetched = () =>
    (Image.prefetch as jest.Mock).mock.calls.map((c) => c[0]);

  it('prefetches the next image story and the next user entry story', async () => {
    await render(
      <StoryProvider users={users} scheme="dark">
        <Harness nav={{ userIndex: 0, storyIndex: 1 }} />
      </StoryProvider>
    );
    expect(prefetched()).toContain('https://x/i3.jpg');
    // bob's entry is a video: not prefetched as an image
    expect(prefetched()).not.toContain('https://x/b1.mp4');
  });

  it('prefetches the next user entry image (first unseen)', async () => {
    let entryUri = '';
    function Probe() {
      const { store } = useStoryContext();
      entryUri = cy.stories[enterUser(2, users, store).storyIndex]!.uri;
      return null;
    }
    await render(
      <StoryProvider users={users} scheme="dark">
        <Probe />
        <Harness nav={{ userIndex: 1, storyIndex: 0 }} />
      </StoryProvider>
    );
    expect(prefetched()).toContain(entryUri);
  });

  it('creates a source-loaded player for the next video', async () => {
    await render(
      <StoryProvider users={users} scheme="dark">
        <VideoSlotsProvider active={undefined} next={v2}>
          {null}
        </VideoSlotsProvider>
      </StoryProvider>
    );
    expect(playerFor(v2)).toBeTruthy();
  });
});
