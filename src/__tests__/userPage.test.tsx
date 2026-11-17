import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';
import {
  getAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { mediaGradient } from '../color/thumbhash';
import { defaultConfig } from '../config';
import { tapNext, tapPrev } from '../model/navigation';
import { StoryProvider } from '../provider/StoryProvider';
import { darkTheme } from '../theme/tokens';
import type { StoryItem, StoryUser } from '../types';
import { UserPage, type UserPageProps } from '../viewer/UserPage';

const WIDTH = 750; // useWindowDimensions in the RN jest preset

const img = (id: string, extra: Partial<StoryItem> = {}): StoryItem => ({
  id,
  type: 'image',
  uri: `https://x/${id}.jpg`,
  ...extra,
});
const ada: StoryUser = {
  id: 'U1',
  name: 'Ada',
  avatar: 'https://x/a.jpg',
  stories: [img('s1'), img('s2'), img('s3')],
};
const bob: StoryUser = {
  id: 'U2',
  name: 'Bob',
  avatar: 'https://x/b.jpg',
  stories: [img('b1')],
};
const users = [ada, bob];

let heldSv: SharedValue<boolean>;
function Page(p: Partial<UserPageProps>) {
  heldSv = useSharedValue(false);
  return (
    <UserPage
      user={ada}
      storyIndex={1}
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

const mount = async (p: Partial<UserPageProps> = {}) =>
  render(
    <StoryProvider users={users} scheme="dark">
      <Page {...p} />
    </StoryProvider>
  );

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};
const display = async () => {
  await act(async () => {
    fireEvent(screen.getByTestId('story-image'), 'display');
  });
};
const fill = () => screen.getByTestId('story-progress-fill');
const fillWidth = () =>
  (getAnimatedStyle as unknown as (e: unknown) => { width: string })(fill())
    .width;
const ui = () => screen.getByTestId('story-ui');
type Json = {
  type: string;
  props: Record<string, unknown>;
  children?: Json[] | null;
};
const collect = (n: Json | Json[] | null, type: string): Json[] => {
  if (!n) return [];
  if (Array.isArray(n)) return n.flatMap((c) => collect(c, type));
  return [
    ...(n.type === type ? [n] : []),
    ...(n.children ?? []).flatMap((c) => collect(c, type)),
  ];
};
const bgStops = () =>
  collect(screen.toJSON() as Json | Json[] | null, 'Stop').map(
    (n) => n.props.stopColor
  );

const state = { userIndex: 0, storyIndex: 1 };

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('UserPage timer', () => {
  it('completes at 5000ms and navigates with tapNext', async () => {
    const onNav = jest.fn();
    await mount({ onNav });
    await display();
    await advance(4900);
    expect(onNav).not.toHaveBeenCalled();
    await advance(200);
    expect(onNav).toHaveBeenCalledTimes(1);
    expect(onNav).toHaveBeenCalledWith(tapNext(state, users));
    expect(fill()).toHaveAnimatedStyle({ width: '100%' });
  });

  it('honours durationMs', async () => {
    const onNav = jest.fn();
    const user = {
      ...ada,
      stories: [img('s1'), img('s2', { durationMs: 2000 }), img('s3')],
    };
    await mount({ onNav, user });
    await display();
    await advance(2100);
    expect(onNav).toHaveBeenCalledWith(tapNext(state, users));
  });

  it('does not run before the image displays', async () => {
    const onNav = jest.fn();
    await mount({ onNav });
    await advance(3000);
    expect(fill()).toHaveAnimatedStyle({ width: '0%' });
    await advance(3000);
    expect(onNav).not.toHaveBeenCalled();
  });

  it('does not run on an inactive page', async () => {
    const onNav = jest.fn();
    await mount({ onNav, isActive: false });
    await display();
    await advance(6000);
    expect(onNav).not.toHaveBeenCalled();
  });

  it('shows the loading indicator only after 250ms', async () => {
    await mount();
    await advance(200);
    expect(screen.queryByTestId('story-loading')).toBeNull();
    await advance(100);
    expect(screen.getByTestId('story-loading')).toBeTruthy();
    await display();
    expect(screen.queryByTestId('story-loading')).toBeNull();
  });

  it('holds while the parent held value is true', async () => {
    const onNav = jest.fn();
    await mount({ onNav });
    await display();
    await advance(1000);
    await act(async () => {
      heldSv.value = true;
    });
    await advance(50); // let the held mirror reach React state
    await advance(10000);
    expect(onNav).not.toHaveBeenCalled();
    await act(async () => {
      heldSv.value = false;
    });
    await advance(50);
    await advance(3850);
    expect(onNav).not.toHaveBeenCalled();
    await advance(300);
    expect(onNav).toHaveBeenCalledTimes(1);
  });
});

describe('UserPage gestures', () => {
  it('left 30% goes back, the rest goes forward', async () => {
    const onNav = jest.fn();
    await mount({ onNav });
    const tap = createGestureController('story-tap');
    await act(async () => {
      tap.begin();
      tap.activate({ x: WIDTH * 0.29 });
      tap.end();
    });
    await advance(50); // scheduleOnRN hop
    expect(onNav).toHaveBeenLastCalledWith(tapPrev(state, users, {}));
    await act(async () => {
      tap.begin();
      tap.activate({ x: WIDTH * 0.31 });
      tap.end();
    });
    await advance(50);
    expect(onNav).toHaveBeenLastCalledWith(tapNext(state, users));
  });

  it('long-press freezes progress and hides the UI; release resumes', async () => {
    const onNav = jest.fn();
    await mount({ onNav });
    await display();
    await advance(1000);
    const press = createGestureController('story-long-press');
    await act(async () => {
      press.begin();
      press.activate();
    });
    await advance(150);
    expect(ui()).toHaveAnimatedStyle({ opacity: 0 });
    expect(ui().props.pointerEvents).toBe('none');
    const frozen = fillWidth();
    expect(frozen).not.toBe('0%');
    await advance(10000);
    expect(fillWidth()).toBe(frozen);
    expect(onNav).not.toHaveBeenCalled();
    await act(async () => {
      press.end();
    });
    await advance(200);
    expect(ui()).toHaveAnimatedStyle({ opacity: 1 });
    await advance(3900);
    expect(onNav).toHaveBeenCalledTimes(1);
  });
});

describe('UserPage seen and errors', () => {
  it('marks the active story on first frame, not before', async () => {
    const onMediaFirstFrame = jest.fn();
    await mount({ onMediaFirstFrame });
    expect(onMediaFirstFrame).not.toHaveBeenCalled();
    await display();
    expect(onMediaFirstFrame).toHaveBeenCalledTimes(1);
    expect(onMediaFirstFrame).toHaveBeenCalledWith(ada.stories[1]);
  });

  it('never marks from a preview page', async () => {
    const onMediaFirstFrame = jest.fn();
    await mount({ onMediaFirstFrame, isActive: false });
    await display();
    expect(onMediaFirstFrame).not.toHaveBeenCalled();
  });

  it('on media error keeps the background, advances after 4000ms, no seen', async () => {
    const onNav = jest.fn();
    const onMediaFirstFrame = jest.fn();
    await mount({ onNav, onMediaFirstFrame });
    await act(async () => {
      fireEvent(screen.getByTestId('story-image'), 'error');
    });
    expect(bgStops()).toEqual([darkTheme.viewer.bgFallback]);
    expect(screen.queryByTestId('story-image')).toBeNull();
    await advance(3900);
    expect(onNav).not.toHaveBeenCalled();
    await advance(200);
    expect(onNav).toHaveBeenCalledWith(tapNext(state, users));
    expect(onMediaFirstFrame).not.toHaveBeenCalled();
  });
});

describe('UserPage visuals', () => {
  it('progress bar is a progressbar labelled Story 2 of 3', async () => {
    await mount();
    const bar = screen.getByRole('progressbar');
    expect(bar.props.accessibilityLabel).toBe('Story 2 of 3');
  });

  it('background stops equal mediaGradient with the theme fallback', async () => {
    const story = img('s2', { colors: ['#112233', '#445566'] });
    await mount({ user: { ...ada, stories: [ada.stories[0]!, story] } });
    expect(bgStops()).toEqual(
      mediaGradient(story, darkTheme.viewer.bgFallback)
    );
  });

  it('uses the thumbhash as image placeholder and the 220ms crossfade', async () => {
    const user = {
      ...ada,
      stories: [ada.stories[0]!, img('s2', { thumbhash: 'AQID' })],
    };
    await mount({ user });
    const image = screen.getByTestId('story-image');
    expect(image.props.placeholder).toEqual({ thumbhash: 'AQID' });
    expect(image.props.transition).toEqual({
      duration: defaultConfig.motion.thumbCrossfadeMs,
      timing: 'linear',
    });
  });
});
