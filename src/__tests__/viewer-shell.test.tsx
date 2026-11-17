import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect, type ReactNode } from 'react';
import { Text } from 'react-native';
import { StoryList } from '../list/StoryList';
import { StoryProvider, useStoryContext } from '../provider/StoryProvider';
import { useStoryViewer } from '../provider/useStoryViewer';
import type { Rect, StoryUser } from '../types';

const story = (id: string, seen = false) => ({
  id,
  type: 'image' as const,
  uri: `https://x/${id}.jpg`,
  seen,
});
const u1: StoryUser = {
  id: 'U1',
  name: 'Ada',
  avatar: 'https://x/a.jpg',
  stories: [story('s1', true), story('s2'), story('s3')],
};
const u2: StoryUser = {
  id: 'U2',
  name: 'Bob',
  avatar: 'https://x/b.jpg',
  stories: [story('b1')],
};

const bubbleRect: Rect = { x: 20, y: 100, width: 76, height: 76 };

let viewer: ReturnType<typeof useStoryViewer>;
function Probe({ rect }: { rect?: Rect }) {
  viewer = useStoryViewer();
  const { registry } = useStoryContext();
  useEffect(
    () =>
      rect ? registry.register('U1', () => Promise.resolve(rect)) : undefined,
    [registry, rect]
  );
  return null;
}

const mount = async (props = {}, rect?: Rect, extra: ReactNode = null) =>
  render(
    <StoryProvider users={[u1, u2]} scheme="light" {...props}>
      <Probe rect={rect} />
      {extra}
    </StoryProvider>
  );

const flush = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('viewer shell', () => {
  it('open renders a modal overlay with the user and first unseen story', async () => {
    await mount();
    await act(async () => viewer.open('U1', bubbleRect));
    expect(
      screen.getByTestId('story-viewer').props.accessibilityViewIsModal
    ).toBe(true);
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByTestId('story-placeholder').props.children).toBe('s2');
  });

  it('X has label and 44x44 hit area; onClose fires once after 300ms', async () => {
    const onClose = jest.fn();
    await mount({ onClose }, bubbleRect);
    await act(async () => viewer.open('U1', bubbleRect));
    const close = screen.getByLabelText('Close stories');
    const style = Object.assign({}, ...[close.props.style].flat(2));
    expect(style.width).toBeGreaterThanOrEqual(44);
    expect(style.height).toBeGreaterThanOrEqual(44);
    await flush(400);
    await fireEvent.press(close);
    await flush(299);
    expect(onClose).not.toHaveBeenCalled();
    await flush(5);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('story-viewer')).toBeNull();
  });

  it('second press during close does not call onClose again', async () => {
    const onClose = jest.fn();
    await mount({ onClose }, bubbleRect);
    await act(async () => viewer.open('U1', bubbleRect));
    await flush(400);
    const close = screen.getByLabelText('Close stories');
    await fireEvent.press(close);
    await flush(100);
    await fireEvent.press(close);
    await flush(1000);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renderHeader replaces the default header and close() closes', async () => {
    const onClose = jest.fn();
    await mount({
      onClose,
      renderHeader: ({ close }: { close(): void }) => (
        <Text onPress={close}>custom header</Text>
      ),
    });
    await act(async () => viewer.open('U1', bubbleRect));
    expect(screen.queryByLabelText('Close stories')).toBeNull();
    await flush(400);
    await fireEvent.press(screen.getByText('custom header'));
    await flush(1000);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('without a source rect close fades out in 200ms', async () => {
    const onClose = jest.fn();
    await mount({ onClose });
    await act(async () => viewer.open('U1'));
    await flush(400);
    await fireEvent.press(screen.getByLabelText('Close stories'));
    await flush(1);
    await flush(190);
    const opacity =
      screen.getByTestId('story-viewer').props.jestAnimatedStyle.value.opacity;
    expect(opacity).toBeLessThan(0.05);
    await flush(20);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('hides the source bubble while open and restores it after close', async () => {
    await mount({}, undefined, <StoryList />);
    const opacityOf = () =>
      Object.assign(
        {},
        ...[
          screen.getByTestId('bubble-U1', { includeHiddenElements: true }).props
            .style,
        ].flat(2)
      ).opacity;
    expect(opacityOf()).not.toBe(0);
    await act(async () => viewer.open('U1'));
    expect(screen.getByTestId('story-viewer')).toBeTruthy();
    expect(opacityOf()).toBe(0);
    await flush(400);
    await fireEvent.press(screen.getByLabelText('Close stories'));
    await flush(150); // bubble measure times out in the test renderer
    await flush(1);
    await flush(400);
    expect(screen.queryByTestId('story-viewer')).toBeNull();
    expect(opacityOf()).not.toBe(0);
  });

  it('shows a relative time label next to the name', async () => {
    const now = 1_700_000_000_000;
    jest.setSystemTime(now);
    const timed: StoryUser = {
      ...u1,
      stories: [{ ...story('t1'), createdAt: now - 2 * 3600 * 1000 }],
    };
    await render(
      <StoryProvider users={[timed]} scheme="light">
        <Probe />
      </StoryProvider>
    );
    await act(async () => viewer.open('U1', bubbleRect));
    expect(screen.getByText('2h')).toBeTruthy();
  });

  it('ignores users with no stories and unknown ids', async () => {
    const onOpen = jest.fn();
    const empty: StoryUser = { ...u2, id: 'emptyUser', stories: [] };
    await render(
      <StoryProvider users={[u1, empty]} scheme="light" onOpen={onOpen}>
        <Probe />
      </StoryProvider>
    );
    await act(async () => viewer.open('emptyUser'));
    await act(async () => viewer.open('nope'));
    expect(screen.queryByTestId('story-viewer')).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
    await act(async () => viewer.open('U1', bubbleRect));
    expect(screen.getByTestId('story-viewer')).toBeTruthy();
    expect(onOpen).toHaveBeenCalledWith('U1');
  });
});
