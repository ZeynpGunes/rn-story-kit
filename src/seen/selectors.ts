import type { StoryUser } from '../types';
import type { SeenStore } from './SeenStore';

export function isUserSeen(u: StoryUser, s: SeenStore): boolean {
  return u.stories.every((st) => s.isSeen(st));
}

/** Index of the first unseen story; 0 when all are seen. */
export function firstUnseenIndex(u: StoryUser, s: SeenStore): number {
  const i = u.stories.findIndex((st) => !s.isSeen(st));
  return i === -1 ? 0 : i;
}

export function visibleUsers(users: StoryUser[]): StoryUser[] {
  return users.filter((u) => u.stories.length > 0);
}

/** Stable: unseen users first when unseenFirst, otherwise input order. */
export function sortUsers(
  users: StoryUser[],
  s: SeenStore,
  unseenFirst: boolean
): StoryUser[] {
  if (!unseenFirst) return users.slice();
  const unseen = users.filter((u) => !isUserSeen(u, s));
  const seen = users.filter((u) => isUserSeen(u, s));
  return [...unseen, ...seen];
}
