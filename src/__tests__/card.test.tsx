import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { StoryCardRing } from '../list/StoryCardRing';
import { StoryList } from '../list/StoryList';
import { StoryProvider, useStoryContext } from '../provider/StoryProvider';
import type { Rect, StoryUser } from '../types';

const wrap = ({ children }: { children: ReactNode }) => (
  <StoryProvider users={[]} scheme="light">
    {children}
  </StoryProvider>
);

type Json = { type: string; props: any; children?: Json[] | null };
const find = (type: string, pred: (n: Json) => boolean): Json | undefined => {
  const walk = (n: Json | Json[] | null): Json | undefined => {
    if (!n) return undefined;
    if (Array.isArray(n)) return n.map(walk).find(Boolean);
    if (n.type === type && pred(n)) return n;
    return walk(n.children ?? null);
  };
  return walk(screen.toJSON() as Json | Json[] | null);
};

describe('StoryCardRing', () => {
  const props = { seen: false, cover: 'https://x/c.jpg', ringId: 'kate' };

  it('is the card size plus ring width and gap on every side', async () => {
    await render(<StoryCardRing {...props} />, { wrapper: wrap });
    const svg = find('Svg', () => true)!;
    expect(svg.props.width).toBe(100 + 2 * (2.5 + 3));
    expect(svg.props.height).toBe(150 + 2 * (2.5 + 3));
  });

  it('draws rounded-rect gradient and seen strokes', async () => {
    await render(<StoryCardRing {...props} />, { wrapper: wrap });
    const active = screen.getByTestId('ring-active-kate');
    expect(active.props.rx).toBe(14 + 3 + 2.5 / 2);
    expect(active.props.stroke).toBe('url(#ring-kate)');
    expect(active.props.strokeWidth).toBe(2.5);
    const seen = screen.getByTestId('ring-seen-kate');
    expect(seen.props.strokeWidth).toBe(1.5);
    expect(
      find('LinearGradient', (n) => n.props.id === 'ring-kate')
    ).toBeTruthy();
  });

  it('uses ringColors for the gradient', async () => {
    await render(
      <StoryCardRing {...props} palette={['#111111', '#222222']} />,
      { wrapper: wrap }
    );
    const g = find('LinearGradient', (n) => n.props.id === 'ring-kate')!;
    expect((g.children ?? []).map((s) => s.props.stopColor)).toEqual([
      '#111111',
      '#222222',
    ]);
  });

  it('fills the card with a cover-fit image', async () => {
    await render(<StoryCardRing {...props} />, { wrapper: wrap });
    const img = find('View', (n) => n.props.source === 'https://x/c.jpg')!;
    expect(img.props.contentFit).toBe('cover');
    expect(img.props.style).toMatchObject({
      width: 100,
      height: 150,
      borderRadius: 14,
    });
  });

  it('omits the ring when showRing is false', async () => {
    await render(<StoryCardRing {...props} showRing={false} />, {
      wrapper: wrap,
    });
    expect(screen.queryByTestId('ring-active-kate')).toBeNull();
    expect(screen.queryByTestId('ring-seen-kate')).toBeNull();
  });
});

describe('StoryList card variant', () => {
  const story = (id: string) => ({
    id,
    type: 'image' as const,
    uri: `https://x/${id}.jpg`,
  });
  const ada: StoryUser = {
    id: 'ada',
    name: 'Ada',
    avatar: 'https://x/a.jpg',
    cover: 'https://x/cover-a.jpg',
    stories: [story('a1')],
  };
  const kate: StoryUser = {
    id: 'kate',
    name: 'Kate',
    avatar: 'https://x/k.jpg',
    suggested: true,
    stories: [story('k1'), story('k2')],
  };
  const owner: StoryUser = {
    id: 'me',
    name: 'me',
    avatar: 'https://x/me.jpg',
    isOwner: true,
    stories: [],
  };
  const withUsers =
    (users: StoryUser[], extra = {}) =>
    ({ children }: { children: ReactNode }) => (
      <StoryProvider users={users} scheme="light" {...extra}>
        {children}
      </StoryProvider>
    );

  it('defaults to circles', async () => {
    await render(<StoryList />, { wrapper: withUsers([ada]) });
    expect(
      find('View', (n) => n.props.source === 'https://x/a.jpg')
    ).toBeTruthy();
    expect(screen.getByTestId('ring-active-ada').props.r).toBeDefined();
  });

  it('variant prop renders cards with the cover image', async () => {
    await render(<StoryList variant="card" />, { wrapper: withUsers([ada]) });
    expect(screen.getByTestId('ring-active-ada').props.rx).toBeDefined();
    expect(
      find('View', (n) => n.props.source === 'https://x/cover-a.jpg')
    ).toBeTruthy();
  });

  it('config.list.variant sets it app-wide and the prop wins', async () => {
    const wrapper = withUsers([ada], { config: { list: { variant: 'card' } } });
    await render(<StoryList />, { wrapper });
    expect(screen.getByTestId('ring-active-ada').props.rx).toBeDefined();
    await screen.rerender(<StoryList variant="circle" />);
    expect(screen.getByTestId('ring-active-ada').props.r).toBeDefined();
  });

  it('falls back to the avatar when there is no cover', async () => {
    await render(<StoryList variant="card" />, {
      wrapper: withUsers([{ ...ada, cover: undefined }]),
    });
    expect(
      find('View', (n) => n.props.source === 'https://x/a.jpg')
    ).toBeTruthy();
  });

  it('seen card has the thin grey stroke', async () => {
    const seenAda = { ...ada, stories: [{ ...ada.stories[0]!, seen: true }] };
    await render(<StoryList variant="card" />, {
      wrapper: withUsers([seenAda]),
    });
    expect(screen.getByTestId('ring-seen-ada').props.strokeWidth).toBe(1.5);
    expect(screen.getByTestId('ring-seen-ada').props.stroke).toBe('#C9CCD1');
  });

  it('card suggested: follow and dismiss work and open nothing', async () => {
    const onFollow = jest.fn();
    const onDismissSuggestion = jest.fn();
    const onOpen = jest.fn();
    await render(<StoryList variant="card" />, {
      wrapper: withUsers([kate], { onFollow, onDismissSuggestion, onOpen }),
    });
    expect(screen.getByLabelText('Kate, suggested, 2 stories')).toBeTruthy();
    const follow = screen.getByLabelText('Follow Kate');
    expect(Object.assign({}, ...[follow.props.style].flat(2))).toMatchObject({
      width: 32,
      height: 32,
    });
    await fireEvent.press(follow);
    expect(onFollow).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText("Don't suggest Kate"));
    expect(onDismissSuggestion).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('empty owner card shows a centred add badge and no ring', async () => {
    const onAddStory = jest.fn();
    await render(<StoryList variant="card" />, {
      wrapper: withUsers([owner], { onAddStory }),
    });
    const badge = screen.getByTestId('owner-add-badge');
    const st = Object.assign({}, ...[badge.props.style].flat(2));
    // Yoga ignores alignSelf on an absolute child once `right` is set.
    expect(st.right).toBeUndefined();
    expect(st.left).toBe((111 - 32) / 2);
    expect(st.width).toBe(32);
    expect(st.bottom).toBe(5.5 + 6);
    expect(screen.queryByTestId('ring-active-me')).toBeNull();
    expect(screen.queryByLabelText(/Follow/)).toBeNull();
    await fireEvent.press(screen.getByTestId('bubble-me'));
    expect(onAddStory).toHaveBeenCalledTimes(1);
  });

  const measureAda = async (
    variant: 'card' | 'circle',
    w: number,
    h: number
  ) => {
    let rect: Rect | null = null;
    function Probe() {
      const { registry } = useStoryContext();
      useEffect(() => {
        registry.measure('ada').then((r) => {
          rect = r;
        });
      }, [registry]);
      return null;
    }
    const spy = jest
      .spyOn(View.prototype as any, 'measureInWindow')
      .mockImplementation(((cb: any) => cb(0, 0, w, h)) as any);
    await render(
      <>
        <StoryList variant={variant} />
        <Probe />
      </>,
      { wrapper: withUsers([ada]) }
    );
    await act(async () => {});
    spy.mockRestore();
    return rect;
  };

  it('measures the card corner radius', async () => {
    expect(await measureAda('card', 111, 161)).toMatchObject({
      width: 111,
      radius: 14 + 5.5,
    });
  });

  it('measures a circle as width / 2', async () => {
    expect(await measureAda('circle', 70, 70)).toMatchObject({ radius: 35 });
  });
});
