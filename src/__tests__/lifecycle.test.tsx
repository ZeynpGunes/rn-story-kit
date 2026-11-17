import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { type ReactNode } from 'react';
import { AccessibilityInfo, AppState, Text } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { StoryProvider, type StorySlotProps } from '../provider/StoryProvider';
import { useStoryViewer } from '../provider/useStoryViewer';
import type { StoryItem, StoryUser } from '../types';

const HOUR = 3600 * 1000;
const img = (id: string, extra: Partial<StoryItem> = {}): StoryItem => ({
  id,
  type: 'image',
  uri: `https://x/${id}.jpg`,
  ...extra,
});
const mk = (id: string, name: string, stories: StoryItem[]): StoryUser => ({
  id,
  name,
  avatar: `https://x/${id}.jpg`,
  stories,
});
const ada = () =>
  mk('U1', 'Ada', [
    img('a1', { createdAt: Date.now() - 2 * HOUR }),
    img('a2'),
    img('a3'),
  ]);
const bob = () => mk('U2', 'Bob', [img('b1'), img('b2')]);
const cy = () => mk('U3', 'Cy', [img('c1')]);

let viewer: ReturnType<typeof useStoryViewer>;
function Probe() {
  viewer = useStoryViewer();
  return null;
}

type Listener = (v: unknown) => void;
let appStateListener: Listener;
let readerListener: Listener;
let readerEnabled = false;
const announce = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
  readerEnabled = false;
  announce.mockClear();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _t: string,
    fn: Listener
  ) => {
    appStateListener = fn;
    return { remove: jest.fn() };
  }) as never);
  jest
    .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
    .mockImplementation(() => Promise.resolve(readerEnabled));
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
    _t: string,
    fn: Listener
  ) => {
    readerListener = fn;
    return { remove: jest.fn() };
  }) as never);
  jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(announce);
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};
const app = (users: StoryUser[], props: Record<string, unknown> = {}) => (
  <StoryProvider users={users} scheme="dark" {...props}>
    <Probe />
  </StoryProvider>
);
const open = async (
  userId = 'U1',
  users = [ada(), bob(), cy()],
  props: Record<string, unknown> = {}
) => {
  const r = await render(app(users, props));
  await act(async () => viewer.open(userId));
  await advance(400);
  return r;
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
const label = (i: number, n: number) =>
  screen.getByLabelText(`Story ${i} of ${n}`);

describe('app state', () => {
  it('background holds progress, active resumes it', async () => {
    await open();
    await display();
    await advance(1000);
    await act(async () => appStateListener('background'));
    const frozen = fillWidth();
    await advance(2000);
    expect(fillWidth()).toBe(frozen);
    await act(async () => appStateListener('active'));
    await advance(1000);
    expect(fillWidth()).not.toBe(frozen);
  });
});

describe('config', () => {
  it('imageDurationMs: 2000 advances at 2000ms', async () => {
    await open('U1', [ada(), bob(), cy()], {
      config: { imageDurationMs: 2000 },
    });
    await display();
    await advance(1900);
    expect(label(1, 3)).toBeTruthy();
    await advance(200);
    expect(label(2, 3)).toBeTruthy();
  });
});

describe('screen reader', () => {
  it('lets progress run to the end but does not advance by default', async () => {
    readerEnabled = true;
    await open();
    await display();
    await advance(6000);
    expect(fillWidth()).toBe('100%');
    expect(label(1, 3)).toBeTruthy();
  });

  it('screenReaderChanged toggles the advance block', async () => {
    await open();
    await display();
    await act(async () => readerListener(true));
    await advance(5100);
    expect(label(1, 3)).toBeTruthy();
  });

  it('autoAdvanceWithScreenReader: true keeps advancing', async () => {
    readerEnabled = true;
    await open('U1', [ada(), bob(), cy()], {
      config: { autoAdvanceWithScreenReader: true },
    });
    await display();
    await advance(5100);
    expect(label(2, 3)).toBeTruthy();
  });

  it('accessibility actions navigate', async () => {
    await open();
    const area = () => screen.getByTestId('story-tap-area');
    expect(
      area().props.accessibilityActions.map((a: { label: string }) => a.label)
    ).toEqual(['Next story', 'Previous story']);
    await act(async () =>
      fireEvent(area(), 'accessibilityAction', {
        nativeEvent: { actionName: 'next' },
      })
    );
    expect(label(2, 3)).toBeTruthy();
    await act(async () =>
      fireEvent(area(), 'accessibilityAction', {
        nativeEvent: { actionName: 'prev' },
      })
    );
    expect(label(1, 3)).toBeTruthy();
  });

  it('magic tap toggles pause', async () => {
    await open();
    await display();
    await advance(1000);
    await act(async () =>
      fireEvent(screen.getByTestId('story-viewer'), 'magicTap')
    );
    const frozen = fillWidth();
    await advance(2000);
    expect(fillWidth()).toBe(frozen);
    await act(async () =>
      fireEvent(screen.getByTestId('story-viewer'), 'magicTap')
    );
    await advance(1000);
    expect(fillWidth()).not.toBe(frozen);
  });

  it('announces the entered story number and time of the shown story', async () => {
    const t = mk('U1', 'Ada', [
      img('a1', { seen: true }),
      img('a2', { seen: true }),
      img('a3', { createdAt: Date.now() - 2 * HOUR }),
    ]);
    await open('U1', [t, bob()]);
    expect(announce).toHaveBeenCalledWith('Ada, story 3 of 3, 2h ago');
  });

  it('does not append "ago" to a custom formatTime', async () => {
    await open('U1', [ada(), bob()], {
      config: { formatTime: () => 'yesterday' },
    });
    expect(announce).toHaveBeenCalledWith('Ada, story 1 of 3, yesterday');
  });

  it('announces the user on open and on user change', async () => {
    await open();
    expect(announce).toHaveBeenCalledWith('Ada, story 1 of 3, 2h ago');
    await act(async () => viewer.goToUser('U2'));
    await advance(1000);
    expect(announce).toHaveBeenLastCalledWith('Bob, story 1 of 2');
  });
});

describe('live users', () => {
  it('removing the active story keeps the user and clamps the index', async () => {
    const r = await open();
    await act(async () => viewer.next());
    await act(async () => viewer.next());
    expect(label(3, 3)).toBeTruthy();
    const trimmed = { ...ada(), stories: ada().stories.slice(0, 2) };
    await act(async () => r.rerender(app([trimmed, bob(), cy()])));
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(label(2, 2)).toBeTruthy();
  });

  it('removing the active user closes exactly once', async () => {
    const onClose = jest.fn();
    const r = await open('U1', [ada(), bob(), cy()], { onClose });
    await act(async () => r.rerender(app([bob(), cy()], { onClose })));
    await advance(1000);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('story-viewer')).toBeNull();
  });

  it('appending users keeps the current story', async () => {
    const r = await open();
    await act(async () => viewer.next());
    await act(async () =>
      r.rerender(app([ada(), bob(), cy(), mk('U4', 'Di', [img('d1')])]))
    );
    expect(label(2, 3)).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
  });

  it('keeps the open order when a user is removed before the active one', async () => {
    const r = await open('U2');
    await act(async () => r.rerender(app([bob(), cy()])));
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByLabelText('Story 1 of 2')).toBeTruthy();
  });
});

describe('imperative api', () => {
  it('is a no-op when closed', async () => {
    const onOpen = jest.fn();
    await render(app([ada(), bob(), cy()], { onOpen }));
    await act(async () => {
      viewer.next();
      viewer.prev();
      viewer.pause();
      viewer.resume();
      viewer.goToUser('U2');
    });
    expect(screen.queryByTestId('story-viewer')).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('next and prev move through stories', async () => {
    await open();
    await act(async () => viewer.next());
    expect(label(2, 3)).toBeTruthy();
    await act(async () => viewer.prev());
    expect(label(1, 3)).toBeTruthy();
  });

  it('pause and resume hold and release progress', async () => {
    await open();
    await display();
    await advance(1000);
    await act(async () => viewer.pause());
    const frozen = fillWidth();
    await advance(2000);
    expect(fillWidth()).toBe(frozen);
    await act(async () => viewer.resume());
    await advance(1000);
    expect(fillWidth()).not.toBe(frozen);
  });

  it('goToUser changes user with the cube and enters at the first unseen story', async () => {
    await open();
    await act(async () => viewer.goToUser('U2'));
    await advance(1000);
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByLabelText('Story 1 of 2')).toBeTruthy();
  });

  it('goToUser reaches a non-adjacent user', async () => {
    await open();
    await act(async () => viewer.goToUser('U3'));
    await advance(1000);
    expect(screen.getByText('Cy')).toBeTruthy();
  });

  it('non-adjacent goToUser puts the new page in place in the same act', async () => {
    await open();
    await act(async () => viewer.goToUser('U3'));
    const style = getAnimatedStyle as unknown as (e: unknown) => {
      opacity: number;
      transform: { translateX?: number }[];
    };
    const st = style(
      screen.getByTestId('story-page-U3', { includeHiddenElements: true })
    );
    expect(st.opacity).toBe(1);
    expect(st.transform.find((x) => 'translateX' in x)?.translateX).toBe(0);
  });

  it('goToUser with an unknown id does nothing', async () => {
    await open();
    await act(async () => viewer.goToUser('nope'));
    await advance(1000);
    expect(screen.getByText('Ada')).toBeTruthy();
  });

  it('open while open does not call onOpen again', async () => {
    const onOpen = jest.fn();
    await render(app([ada(), bob(), cy()], { onOpen }));
    await act(async () => {
      viewer.open('U1');
      viewer.open('U2');
    });
    await advance(400);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Ada')).toBeTruthy();
  });
});

describe('slots', () => {
  const slot =
    (text: string, extra: ReactNode = null) =>
    ({ user }: StorySlotProps) => (
      <>
        <Text>{`${text}:${user.name}`}</Text>
        {extra}
      </>
    );

  it('slot pause() and resume() hold and release progress', async () => {
    let api: StorySlotProps;
    await open('U1', [ada(), bob(), cy()], {
      renderFooter: (p: StorySlotProps) => {
        api = p;
        return null;
      },
    });
    await display();
    await advance(1000);
    await act(async () => api.pause());
    const frozen = fillWidth();
    await advance(2000);
    expect(fillWidth()).toBe(frozen);
    await act(async () => api.resume());
    await advance(1000);
    expect(fillWidth()).not.toBe(frozen);
  });

  it('footer and overlay render for the active page only', async () => {
    await open('U1', [ada(), bob(), cy()], {
      renderFooter: slot('foot'),
      renderOverlay: slot('over'),
    });
    expect(
      screen.getAllByText(/^foot:/, { includeHiddenElements: true })
    ).toHaveLength(1);
    expect(
      screen.getAllByText(/^over:/, { includeHiddenElements: true })
    ).toHaveLength(1);
    expect(screen.getByText('foot:Ada')).toBeTruthy();
  });

  it('slots sit inside the UI layer and let touches through', async () => {
    await open('U1', [ada(), bob(), cy()], {
      renderFooter: slot('foot'),
      renderOverlay: slot('over'),
    });
    const ui = screen.getByTestId('story-ui');
    expect(ui).toContainElement(screen.getByText('foot:Ada'));
    expect(ui).toContainElement(screen.getByText('over:Ada'));
    expect(screen.getByTestId('story-footer').props.pointerEvents).toBe(
      'box-none'
    );
    expect(screen.getByTestId('story-overlay').props.pointerEvents).toBe(
      'box-none'
    );
  });

  it('renderHeader returning undefined falls back to the default header', async () => {
    await open('U1', [ada(), bob(), cy()], { renderHeader: () => undefined });
    expect(screen.getByLabelText('Close stories')).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
  });

  it('renderHeader returning null renders no header', async () => {
    await open('U1', [ada(), bob(), cy()], { renderHeader: () => null });
    expect(screen.queryByLabelText('Close stories')).toBeNull();
    expect(screen.queryByText('Ada')).toBeNull();
  });
});
