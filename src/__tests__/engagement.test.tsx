import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';
import {
  StoryProvider,
  useStoryContext,
  type StorySlotProps,
} from '../provider/StoryProvider';
import { useStoryViewer } from '../provider/useStoryViewer';
import type { StoryUser } from '../types';

const story = (
  id: string,
  extra: Partial<StoryUser['stories'][number]> = {}
) => ({
  id,
  type: 'image' as const,
  uri: `https://x/${id}.jpg`,
  ...extra,
});

const owner: StoryUser = {
  id: 'me',
  name: 'Me',
  avatar: 'https://x/me.jpg',
  isOwner: true,
  stories: [
    story('own-1', {
      viewCount: 2,
      likeCount: 1,
      viewers: [
        { id: 'a', name: 'Ada', avatar: 'https://x/a.jpg' },
        { id: 'b', name: 'Bob', avatar: 'https://x/b.jpg' },
      ],
      likers: [{ id: 'a', name: 'Ada', avatar: 'https://x/a.jpg' }],
    }),
  ],
};

const other: StoryUser = {
  id: 'other',
  name: 'Other',
  avatar: 'https://x/o.jpg',
  stories: [story('o-1', { liked: false })],
};

let viewer: ReturnType<typeof useStoryViewer>;
function Probe() {
  viewer = useStoryViewer();
  const { registry } = useStoryContext();
  useEffect(
    () =>
      registry.register('me', () =>
        Promise.resolve({ x: 0, y: 0, width: 40, height: 40 })
      ),
    [registry]
  );
  useEffect(
    () =>
      registry.register('other', () =>
        Promise.resolve({ x: 0, y: 0, width: 40, height: 40 })
      ),
    [registry]
  );
  return null;
}

const mount = async (props: Record<string, unknown> = {}, users = [owner, other]) =>
  render(
    <StoryProvider users={users} scheme="light" {...props}>
      <Probe />
    </StoryProvider>
  );

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('engagement footer', () => {
  it('owner sees view/like counts and opens the viewers modal', async () => {
    await mount();
    await act(async () => viewer.open('me'));
    expect(screen.getByTestId('owner-insights')).toBeTruthy();
    expect(screen.queryByTestId('actions-bar')).toBeNull();
    expect(screen.getByLabelText('2 views')).toBeTruthy();
    expect(screen.getByLabelText('1 like')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('owner-views'));
    expect(screen.getByTestId('engagement-modal')).toBeTruthy();
    expect(screen.getByText('Viewers')).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('owner likes list opens from the like count', async () => {
    await mount();
    await act(async () => viewer.open('me'));
    await fireEvent.press(screen.getByTestId('owner-likes'));
    expect(screen.getByText('Likes')).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
  });

  it('non-owner sees the action bar and fires callbacks', async () => {
    const onLike = jest.fn();
    const onSendMessage = jest.fn();
    const onVoice = jest.fn();
    const onShare = jest.fn();
    await mount({ onLike, onSendMessage, onVoice, onShare });
    await act(async () => viewer.open('other'));

    expect(screen.getByTestId('actions-bar')).toBeTruthy();
    expect(screen.queryByTestId('owner-insights')).toBeNull();

    await fireEvent.press(screen.getByTestId('actions-like'));
    expect(onLike).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'o-1' }),
      expect.objectContaining({ id: 'other' }),
      true
    );

    await fireEvent.changeText(screen.getByTestId('actions-message'), 'hi');
    await fireEvent(screen.getByTestId('actions-message'), 'submitEditing');
    expect(onSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'o-1' }),
      expect.objectContaining({ id: 'other' }),
      'hi'
    );

    await fireEvent.press(screen.getByTestId('actions-voice'));
    expect(onVoice).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('actions-share'));
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('hides action controls when config.actions flags are false', async () => {
    await mount({
      config: {
        actions: { message: false, like: false, voice: true, share: false },
      },
    });
    await act(async () => viewer.open('other'));
    expect(screen.queryByTestId('actions-message')).toBeNull();
    expect(screen.queryByTestId('actions-like')).toBeNull();
    expect(screen.queryByTestId('actions-share')).toBeNull();
    expect(screen.getByTestId('actions-voice')).toBeTruthy();
  });

  it('custom renderFooter replaces the default footer', async () => {
    await mount({
      renderFooter: (_p: StorySlotProps) => <Text>custom footer</Text>,
    });
    await act(async () => viewer.open('other'));
    expect(screen.getByText('custom footer')).toBeTruthy();
    expect(screen.queryByTestId('actions-bar')).toBeNull();
    expect(screen.queryByTestId('owner-insights')).toBeNull();
  });
});
