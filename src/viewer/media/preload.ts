import { Image } from 'expo-image';
import { useEffect } from 'react';
import { enterUser, type NavState } from '../../model/navigation';
import { useStoryContext } from '../../provider/StoryProvider';
import type { SeenStore } from '../../seen/SeenStore';
import type { StoryItem, StoryUser } from '../../types';

export interface PreloadTargets {
  /** The story after the current one within the same user. */
  nextStory?: StoryItem;
  /** Entry story (first unseen) of the next user. */
  nextUserEntry?: StoryItem;
}

export function preloadTargets(
  users: StoryUser[],
  nav: NavState,
  seen: SeenStore
): PreloadTargets {
  const nextUser = users[nav.userIndex + 1];
  return {
    nextStory: users[nav.userIndex]?.stories[nav.storyIndex + 1],
    nextUserEntry: nextUser
      ? nextUser.stories[enterUser(nav.userIndex + 1, users, seen).storyIndex]
      : undefined,
  };
}

/** The single video worth holding a preloaded player for, if any. */
export function nextVideoTarget(t: PreloadTargets): StoryItem | undefined {
  return [t.nextStory, t.nextUserEntry].find((s) => s?.type === 'video');
}

/**
 * Prefetch the next story and the next user's entry story when they are
 * images. Videos are preloaded by the player pool instead (see videoSlots).
 */
export function usePreload(users: StoryUser[], nav: NavState): void {
  const { store } = useStoryContext();
  const { userIndex, storyIndex } = nav;
  const t = preloadTargets(users, { userIndex, storyIndex }, store);
  const uris = [t.nextStory, t.nextUserEntry]
    .filter((s): s is StoryItem => s?.type === 'image')
    .map((s) => s.uri)
    .join('\n');
  useEffect(() => {
    if (!uris) return;
    for (const uri of uris.split('\n')) Image.prefetch(uri).catch(() => {});
  }, [uris]);
}
