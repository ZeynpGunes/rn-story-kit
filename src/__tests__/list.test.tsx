import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect, type ReactNode } from 'react';
import { StoryList } from '../list/StoryList';
import { StoryRing } from '../list/StoryRing';
import {
  StoryProvider,
  useSeenStore,
  useStoryContext,
} from '../provider/StoryProvider';
import type { Rect, StoryUser } from '../types';

const story = (id: string) => ({
  id,
  type: 'image' as const,
  uri: `https://x/${id}.jpg`,
});
const ada: StoryUser = {
  id: 'ada',
  name: 'Ada',
  avatar: 'https://x/a.jpg',
  stories: [story('a1'), story('a2'), story('a3')],
};
const bob: StoryUser = {
  id: 'bob',
  name: 'Bob',
  avatar: 'https://x/b.jpg',
  stories: [story('b1')],
};
const empty: StoryUser = { ...bob, id: 'eve', name: 'Eve', stories: [] };

const wrap = (users: StoryUser[], extra = {}) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StoryProvider users={users} scheme="light" {...extra}>
        {children}
      </StoryProvider>
    );
  };

type Json = { type: string; props: any; children?: Json[] | null };

const findGradient = (id: string): Json => {
  const walk = (n: Json | Json[] | null): Json | undefined => {
    if (!n) return undefined;
    if (Array.isArray(n)) return n.map(walk).find(Boolean);
    if (n.type === 'LinearGradient' && n.props.id === `ring-${id}`) return n;
    return walk(n.children ?? null);
  };
  const found = walk(screen.toJSON() as Json | Json[] | null);
  if (!found) throw new Error(`no gradient ring-${id}`);
  return found;
};

const gradientStops = (id: string) =>
  (findGradient(id).children ?? []).map((s) => s.props.stopColor);

describe('StoryList', () => {
  it('renders one bubble per visible user, unseen first', async () => {
    const seenAda = {
      ...ada,
      stories: ada.stories.map((s) => ({ ...s, seen: true })),
    };
    await render(<StoryList />, { wrapper: wrap([seenAda, bob, empty]) });
    const bubbles = screen.getAllByRole('button');
    expect(bubbles.map((b) => b.props.accessibilityLabel)).toEqual([
      'Bob, new story, 1 stories',
      'Ada, seen, 3 stories',
    ]);
  });

  it('owner bubble shows Your story and add badge when empty', async () => {
    const onAddStory = jest.fn();
    const owner: StoryUser = {
      id: 'me',
      name: 'me',
      avatar: 'https://x/me.jpg',
      isOwner: true,
      stories: [],
    };
    await render(<StoryList />, {
      wrapper: wrap([owner, bob], {
        onAddStory,
        config: { strings: { yourStory: 'Hikayen', addStory: 'Hikaye ekle' } },
      }),
    });
    expect(screen.getByText('Hikayen')).toBeTruthy();
    expect(screen.getByTestId('owner-add-badge')).toBeTruthy();
    expect(screen.queryByTestId('ring-seen-me')).toBeNull();
    expect(screen.queryByTestId('ring-active-me')).toBeNull();
    expect(screen.getByLabelText('Hikaye ekle')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('bubble-me'));
    expect(onAddStory).toHaveBeenCalledTimes(1);
  });

  it('hides owner when ownerBubble.show is false', async () => {
    const owner: StoryUser = { ...ada, isOwner: true };
    await render(<StoryList />, {
      wrapper: wrap([owner, bob], {
        config: { ownerBubble: { show: false } },
      }),
    });
    expect(screen.queryByTestId('bubble-ada')).toBeNull();
    expect(screen.getByTestId('bubble-bob')).toBeTruthy();
  });

  it('does not stretch the list to fill the parent height', async () => {
    await render(<StoryList />, { wrapper: wrap([ada, bob]) });
    const list = screen.getByTestId('story-list');
    const style = Object.assign({}, ...[list.props.style].flat(2));
    expect(style.flexGrow).toBe(0);
  });

  it('sortUnseenFirst: false keeps the input order', async () => {
    const seenAda = {
      ...ada,
      stories: ada.stories.map((s) => ({ ...s, seen: true })),
    };
    await render(<StoryList />, {
      wrapper: wrap([seenAda, bob], { config: { sortUnseenFirst: false } }),
    });
    expect(
      screen.getAllByRole('button').map((b) => b.props.accessibilityLabel)
    ).toEqual(['Ada, seen, 3 stories', 'Bob, new story, 1 stories']);
  });

  it('renders nothing for no users', async () => {
    await render(<StoryList />, { wrapper: wrap([]) });
    expect(screen.queryByTestId('story-list')).toBeNull();
  });

  it('opens the viewer with the measured rect on press', async () => {
    const rect: Rect = { x: 1, y: 2, width: 76, height: 76 };
    const onOpen = jest.fn();
    let opened: unknown;
    function Probe() {
      const ctx = useStoryContext();
      opened = ctx.opened;
      useEffect(() => ctx.registry.register('ada', async () => rect), [ctx]);
      return null;
    }
    await render(
      <>
        <StoryList />
        <Probe />
      </>,
      { wrapper: wrap([ada], { onOpen }) }
    );
    await fireEvent.press(screen.getByLabelText('Ada, new story, 3 stories'));
    expect(onOpen).toHaveBeenCalledWith('ada');
    expect(opened).toMatchObject({ userId: 'ada', rect });
  });

  it('labels new then seen and thins the seen ring', async () => {
    let store: ReturnType<typeof useSeenStore>;
    function Probe() {
      store = useSeenStore();
      return null;
    }
    await render(
      <>
        <Probe />
        <StoryList />
      </>,
      { wrapper: wrap([ada]) }
    );
    expect(screen.getByLabelText('Ada, new story, 3 stories')).toBeTruthy();
    await act(async () => {
      ada.stories.forEach((s) => store.markSeen(s.id, 'ada'));
    });
    expect(screen.getByLabelText('Ada, seen, 3 stories')).toBeTruthy();
    expect(screen.getByTestId('ring-seen-ada').props.strokeWidth).toBe(1.5);
  });

  it('calls onEndReached from the list', async () => {
    const onEndReached = jest.fn();
    await render(<StoryList />, { wrapper: wrap([ada], { onEndReached }) });
    await fireEvent(screen.getByTestId('story-list'), 'endReached');
    expect(onEndReached).toHaveBeenCalled();
  });

  it('ringColors override applies to that bubble only', async () => {
    const custom = ['#111111', '#222222', '#111111'];
    await render(<StoryList />, {
      wrapper: wrap([{ ...ada, ringColors: custom }, bob]),
    });
    expect(gradientStops('ada')).toEqual(custom);
    expect(gradientStops('bob')[0]).toBe('#FFC247');
  });
});

describe('StoryList robustness', () => {
  const openWith = async (measure: () => Promise<Rect | null>) => {
    const onOpen = jest.fn();
    let opened: any;
    function Probe() {
      const ctx = useStoryContext();
      opened = ctx.opened;
      useEffect(() => ctx.registry.register('ada', measure), [ctx]);
      return null;
    }
    await render(
      <>
        <StoryList />
        <Probe />
      </>,
      { wrapper: wrap([ada], { onOpen }) }
    );
    return { onOpen, get: () => opened };
  };

  it('opens without rect when measure never resolves', async () => {
    const r = await openWith(() => new Promise(() => {}));
    const start = Date.now();
    await fireEvent.press(screen.getByLabelText('Ada, new story, 3 stories'));
    expect(Date.now() - start).toBeGreaterThanOrEqual(140);
    await act(async () => {});
    expect(r.onOpen).toHaveBeenCalledWith('ada');
    expect(r.get()).toMatchObject({ userId: 'ada', rect: null });
  });

  it('opens without rect when measure rejects', async () => {
    const r = await openWith(() => Promise.reject(new Error('boom')));
    await fireEvent.press(screen.getByLabelText('Ada, new story, 3 stories'));
    expect(r.get()).toMatchObject({ userId: 'ada', rect: null });
  });

  it('calls the latest onEndReached after rerender', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const el = (cb: () => void) => (
      <StoryProvider users={[ada]} scheme="light" onEndReached={cb}>
        <StoryList />
      </StoryProvider>
    );
    const view = await render(el(first));
    await view.rerender(el(second));
    await fireEvent(screen.getByTestId('story-list'), 'endReached');
    expect(second).toHaveBeenCalled();
    expect(first).not.toHaveBeenCalled();
  });
});

describe('StoryRing', () => {
  it('handles a single colour without NaN offsets', async () => {
    await render(
      <StoryRing
        size="md"
        seen={false}
        avatar="a"
        ringId="s"
        palette={['#123456']}
      />,
      { wrapper: wrap([]) }
    );
    const stops = findGradient('s').children ?? [];
    expect(stops).toHaveLength(1);
    expect(stops[0]!.props.offset).toBe(0);
  });

  it('uses unique gradient ids per ring', async () => {
    await render(
      <>
        <StoryRing size="md" seen={false} avatar="a" ringId="one" />
        <StoryRing size="md" seen={false} avatar="b" ringId="two" />
      </>,
      { wrapper: wrap([]) }
    );
    expect(findGradient('one').props.id).toBe('ring-one');
    expect(findGradient('two').props.id).toBe('ring-two');
    expect(findGradient('one').props.id).not.toBe(findGradient('two').props.id);
  });

  it('closeFriends palette uses its stops', async () => {
    await render(
      <StoryRing
        size="md"
        seen={false}
        avatar="a"
        ringId="cf"
        palette="closeFriends"
      />,
      { wrapper: wrap([]) }
    );
    expect(gradientStops('cf')).toEqual([
      '#3DDC84',
      '#12B76A',
      '#7AE582',
      '#12B76A',
      '#3DDC84',
    ]);
  });
});
