import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { act } from '@testing-library/react-native';
import { useState, type ReactNode } from 'react';
import { StoryList } from '../list/StoryList';
import { StoryProvider, useStoryContext } from '../provider/StoryProvider';
import type { StoryUser } from '../types';

const story = (id: string) => ({
  id,
  type: 'image' as const,
  uri: `https://x/${id}.jpg`,
});
const ada: StoryUser = {
  id: 'ada',
  name: 'Ada',
  avatar: 'https://x/a.jpg',
  stories: [story('a1'), story('a2')],
};
const kate: StoryUser = {
  id: 'kate',
  name: 'Kate',
  avatar: 'https://x/k.jpg',
  suggested: true,
  stories: [story('k1'), story('k2'), story('k3')],
};

const flat = (style: unknown) => Object.assign({}, ...[style].flat(2));

const wrap = (users: StoryUser[], extra = {}) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StoryProvider users={users} scheme="light" {...extra}>
        {children}
      </StoryProvider>
    );
  };

describe('suggested bubbles (circle)', () => {
  it('shows follow and dismiss only on suggested users', async () => {
    await render(<StoryList />, { wrapper: wrap([ada, kate]) });
    expect(screen.getByLabelText('Follow Kate')).toBeTruthy();
    expect(screen.getByLabelText("Don't suggest Kate")).toBeTruthy();
    expect(screen.queryByLabelText('Follow Ada')).toBeNull();
    expect(screen.queryByLabelText("Don't suggest Ada")).toBeNull();
  });

  it('labels the bubble as suggested', async () => {
    await render(<StoryList />, { wrapper: wrap([kate]) });
    expect(screen.getByLabelText('Kate, suggested, 3 stories')).toBeTruthy();
  });

  it('follow calls onFollow, hides the follow button, opens nothing', async () => {
    const onFollow = jest.fn();
    const onOpen = jest.fn();
    await render(<StoryList />, {
      wrapper: wrap([kate], { onFollow, onOpen }),
    });
    await fireEvent.press(screen.getByLabelText('Follow Kate'));
    expect(onFollow).toHaveBeenCalledWith({
      id: 'kate',
      name: 'Kate',
      avatar: 'https://x/k.jpg',
      following: false,
    });
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Follow Kate')).toBeNull();
    expect(screen.getByLabelText("Don't suggest Kate")).toBeTruthy();
    expect(screen.getByTestId('bubble-kate')).toBeTruthy();
  });

  it('dismiss calls onDismissSuggestion, removes the bubble, opens nothing', async () => {
    const onDismissSuggestion = jest.fn();
    const onOpen = jest.fn();
    await render(<StoryList />, {
      wrapper: wrap([ada, kate], { onDismissSuggestion, onOpen }),
    });
    await fireEvent.press(screen.getByLabelText("Don't suggest Kate"));
    expect(onDismissSuggestion).toHaveBeenCalledWith(kate);
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.queryByTestId('bubble-kate')).toBeNull();
    expect(screen.getByTestId('bubble-ada')).toBeTruthy();
  });

  it.each(['circle', 'card'] as const)(
    'badges are separate accessible buttons, not inside the bubble (%s)',
    async (variant) => {
      const onOpen = jest.fn();
      await render(<StoryList variant={variant} />, {
        wrapper: wrap([kate], { onOpen }),
      });
      const bubble = screen.getByTestId('bubble-kate');
      for (const label of ['Follow Kate', "Don't suggest Kate"]) {
        const btn = screen.getByRole('button', { name: label });
        expect(btn.props.accessible).not.toBe(false);
        expect(within(bubble).queryByLabelText(label)).toBeNull();
        await fireEvent.press(btn);
      }
      expect(onOpen).not.toHaveBeenCalled();
    }
  );

  it('uses the normal bubble label after following', async () => {
    await render(<StoryList />, { wrapper: wrap([kate]) });
    await fireEvent.press(screen.getByLabelText('Follow Kate'));
    expect(screen.queryByLabelText(/suggested/)).toBeNull();
    expect(screen.getByLabelText('Kate, new story, 3 stories')).toBeTruthy();
  });

  it('never shows follow or dismiss for the owner', async () => {
    const owner: StoryUser = { ...kate, id: 'me', isOwner: true };
    await render(<StoryList />, { wrapper: wrap([owner]) });
    expect(screen.queryByLabelText('Follow Kate')).toBeNull();
    expect(screen.queryByLabelText("Don't suggest Kate")).toBeNull();
    expect(screen.queryByLabelText(/suggested/)).toBeNull();
  });

  it('tapping the bubble still opens the viewer', async () => {
    const onOpen = jest.fn();
    await render(<StoryList />, { wrapper: wrap([kate], { onOpen }) });
    await fireEvent.press(screen.getByLabelText('Kate, suggested, 3 stories'));
    expect(onOpen).toHaveBeenCalledWith('kate');
  });

  it.each([
    ['circle', 84, 75 + 6 + 16],
    ['card', 111, 161 + 8 + 16],
  ] as const)(
    'each badge has a 44x44 target inside the item bounds (%s)',
    async (variant, itemW, minH) => {
      await render(<StoryList variant={variant} />, {
        wrapper: wrap([kate]),
      });
      const wrapStyle = flat(
        screen.getByTestId('bubble-wrap-kate').props.style
      );
      expect(wrapStyle.width).toBe(itemW);
      for (const label of ['Follow Kate', "Don't suggest Kate"]) {
        const btn = screen.getByLabelText(label);
        const st = flat(btn.props.style);
        const slop = btn.props.hitSlop;
        expect(st.width + slop.left + slop.right).toBeGreaterThanOrEqual(44);
        expect(st.height + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
        expect(st.left - slop.left).toBeGreaterThanOrEqual(0);
        expect(st.left + st.width + slop.right).toBeLessThanOrEqual(itemW);
        expect(st.top - slop.top).toBeGreaterThanOrEqual(0);
        expect(st.top + st.height + slop.bottom).toBeLessThanOrEqual(minH);
      }
    }
  );

  it('draws the circle X inside the ring corner with a 2px list-colour border', async () => {
    await render(<StoryList />, { wrapper: wrap([kate]) });
    const st = flat(screen.getByLabelText("Don't suggest Kate").props.style);
    expect(st.borderWidth).toBe(2);
    expect(st.borderColor).toBe('#FFFFFF');
    // ring spans x 4.5..79.5 in the 84pt item
    expect(st.left + st.width).toBeLessThan(79.5);
    expect(st.top).toBeGreaterThan(0);
  });

  it.each(['circle', 'card'] as const)(
    'the bubble press area ends at its label (%s)',
    async (variant) => {
      await render(<StoryList variant={variant} />, {
        wrapper: wrap([kate]),
      });
      const bubble = screen.getByTestId('bubble-kate');
      const st = flat(bubble.props.style);
      expect(bubble.props.hitSlop).toBeUndefined();
      for (const key of ['paddingBottom', 'paddingVertical', 'padding']) {
        expect(st[key]).toBeUndefined();
      }
      expect(st.minHeight).toBeUndefined();
      expect(st.height).toBeUndefined();
      const wrapStyle = flat(
        screen.getByTestId('bubble-wrap-kate').props.style
      );
      expect(wrapStyle.height).toBeUndefined();
      expect(wrapStyle.paddingBottom).toBeUndefined();
    }
  );

  it('uses overridden strings', async () => {
    await render(<StoryList />, {
      wrapper: wrap([kate], {
        config: {
          strings: {
            followSuggested: 'Takip et {name}',
            dismissSuggestion: 'Önerme {name}',
            bubbleSuggested: '{name}, önerilen, {count}',
          },
        },
      }),
    });
    expect(screen.getByLabelText('Takip et Kate')).toBeTruthy();
    expect(screen.getByLabelText('Önerme Kate')).toBeTruthy();
    expect(screen.getByLabelText('Kate, önerilen, 3')).toBeTruthy();
  });
});

let setHostUsers: (users: StoryUser[]) => void;
function Host({ initial }: { initial: StoryUser[] }) {
  const [users, setUsers] = useState(initial);
  setHostUsers = setUsers;
  return (
    <StoryProvider users={users} scheme="light">
      <StoryList />
    </StoryProvider>
  );
}

describe('dismissed and followed state follows the users prop', () => {
  it('shows a dismissed user again when sent with suggested: false', async () => {
    await render(<Host initial={[ada, kate]} />);
    await fireEvent.press(screen.getByLabelText("Don't suggest Kate"));
    expect(screen.queryByTestId('bubble-kate')).toBeNull();
    await act(async () => setHostUsers([ada, { ...kate, suggested: false }]));
    expect(screen.getByTestId('bubble-kate')).toBeTruthy();
  });

  it('shows a re-suggested user again after it was absent', async () => {
    await render(<Host initial={[ada, kate]} />);
    await fireEvent.press(screen.getByLabelText("Don't suggest Kate"));
    await act(async () => setHostUsers([ada]));
    await act(async () => setHostUsers([ada, kate]));
    expect(screen.getByTestId('bubble-kate')).toBeTruthy();
    expect(screen.getByLabelText('Follow Kate')).toBeTruthy();
  });

  it('shows the follow button again when a followed user is re-suggested', async () => {
    await render(<Host initial={[ada, kate]} />);
    await fireEvent.press(screen.getByLabelText('Follow Kate'));
    expect(screen.queryByLabelText('Follow Kate')).toBeNull();
    await act(async () => setHostUsers([ada, { ...kate, suggested: false }]));
    await act(async () => setHostUsers([ada, kate]));
    expect(screen.getByLabelText('Follow Kate')).toBeTruthy();
  });
});

describe('viewer playback skips dismissed users', () => {
  const bob: StoryUser = { ...ada, id: 'bob', name: 'Bob' };
  const run = async (open: string) => {
    let ctx!: ReturnType<typeof useStoryContext>;
    function Probe() {
      ctx = useStoryContext();
      return null;
    }
    await render(
      <>
        <StoryList />
        <Probe />
      </>,
      { wrapper: wrap([ada, kate, bob]) }
    );
    await fireEvent.press(screen.getByLabelText("Don't suggest Kate"));
    await act(async () => ctx.api.open(open));
    return ctx;
  };

  it('opens without the dismissed user in the swipe order', async () => {
    const ctx = await run('ada');
    expect(ctx.opened?.users.map((u) => u.id)).toEqual(['ada', 'bob']);
  });

  it('refuses to open a dismissed user directly', async () => {
    const ctx = await run('kate');
    expect(ctx.opened).toBeNull();
  });
});
