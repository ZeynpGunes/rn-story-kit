import type { SeenStore } from '../seen/SeenStore';
import { firstUnseenIndex } from '../seen/selectors';
import type { StoryUser } from '../types';

export interface NavState {
  userIndex: number;
  storyIndex: number;
}

export type NavResult =
  | { kind: 'story'; state: NavState }
  | { kind: 'user'; state: NavState; direction: 1 | -1 }
  | { kind: 'restart'; state: NavState }
  | { kind: 'close' };

/** Right-side tap: next story, else next user, else close. */
export function tapNext(s: NavState, users: StoryUser[]): NavResult {
  const user = users[s.userIndex];
  if (user && s.storyIndex < user.stories.length - 1) {
    return {
      kind: 'story',
      state: { userIndex: s.userIndex, storyIndex: s.storyIndex + 1 },
    };
  }
  if (s.userIndex < users.length - 1) {
    return {
      kind: 'user',
      direction: 1,
      state: { userIndex: s.userIndex + 1, storyIndex: 0 },
    };
  }
  return { kind: 'close' };
}

/**
 * Left-side tap: previous story, else previous user (last viewed story, or
 * the last one), else restart the first story.
 */
export function tapPrev(
  s: NavState,
  users: StoryUser[],
  lastViewed: Record<string, number>
): NavResult {
  if (s.storyIndex > 0) {
    return {
      kind: 'story',
      state: { userIndex: s.userIndex, storyIndex: s.storyIndex - 1 },
    };
  }
  const prev = users[s.userIndex - 1];
  if (!prev) {
    return {
      kind: 'restart',
      state: { userIndex: s.userIndex, storyIndex: 0 },
    };
  }
  const last = prev.stories.length - 1;
  const viewed = lastViewed[prev.id];
  const storyIndex =
    viewed === undefined ? last : Math.max(0, Math.min(viewed, last));
  return {
    kind: 'user',
    direction: -1,
    state: { userIndex: s.userIndex - 1, storyIndex },
  };
}

/**
 * Opening a user starts at its `startIndex` when in range, else at the first
 * unseen story (0 when all seen).
 */
export function enterUser(
  userIndex: number,
  users: StoryUser[],
  seen: SeenStore
): NavState {
  const user = users[userIndex];
  if (!user) return { userIndex, storyIndex: 0 };
  const start = user.startIndex;
  const storyIndex =
    start !== undefined &&
    Number.isInteger(start) &&
    start >= 0 &&
    start < user.stories.length
      ? start
      : firstUnseenIndex(user, seen);
  return { userIndex, storyIndex };
}

/** Horizontal swipe between users; null at either edge (never closes). */
export function swipeToUser(
  s: NavState,
  direction: 1 | -1,
  users: StoryUser[],
  seen: SeenStore
): NavResult | null {
  const target = s.userIndex + direction;
  if (target < 0 || target >= users.length) return null;
  return {
    kind: 'user',
    direction,
    state: enterUser(target, users, seen),
  };
}

/**
 * Re-locate the viewed story after the users list changed. Null when the
 * user is gone; clamps the story index when only the story is gone.
 */
export function reconcileNavState(
  prev: { userId: string; storyId: string },
  users: StoryUser[]
): NavState | null {
  const userIndex = users.findIndex((u) => u.id === prev.userId);
  const user = users[userIndex];
  if (!user) return null;
  const found = user.stories.findIndex((st) => st.id === prev.storyId);
  const storyIndex =
    found !== -1 ? found : Math.max(0, user.stories.length - 1);
  return { userIndex, storyIndex };
}
