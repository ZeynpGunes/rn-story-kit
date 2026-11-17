import type { StoryOwnerBubbleConfig } from '../config';
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

/** Users shown in the horizontal list (may include an empty owner add bubble). */
export function visibleUsers(
  users: StoryUser[],
  ownerBubble: StoryOwnerBubbleConfig = {
    show: true,
    pinFirst: true,
    showAddWhenEmpty: true,
  }
): StoryUser[] {
  return users.filter((u) => {
    if (u.isOwner) {
      if (!ownerBubble.show) return false;
      if (u.stories.length > 0) return true;
      return ownerBubble.showAddWhenEmpty;
    }
    return u.stories.length > 0;
  });
}

/** Drops suggested users the viewer dismissed. Non-suggested users always stay. */
export function withoutDismissed(
  users: StoryUser[],
  dismissedIds: ReadonlySet<string>
): StoryUser[] {
  return users.filter((u) => !(u.suggested === true && dismissedIds.has(u.id)));
}

/** Users that can open in the viewer (always need at least one story). */
export function playbackUsers(users: StoryUser[]): StoryUser[] {
  return users.filter((u) => u.stories.length > 0);
}

/** Stable: owner optionally pinned first, then unseen-first or input order. */
export function sortUsers(
  users: StoryUser[],
  s: SeenStore,
  unseenFirst: boolean,
  ownerBubble: StoryOwnerBubbleConfig = {
    show: true,
    pinFirst: true,
    showAddWhenEmpty: true,
  }
): StoryUser[] {
  const owner = users.filter((u) => u.isOwner);
  const rest = users.filter((u) => !u.isOwner);
  const orderedRest = (() => {
    if (!unseenFirst) return rest.slice();
    const unseen = rest.filter((u) => !isUserSeen(u, s));
    const seen = rest.filter((u) => isUserSeen(u, s));
    return [...unseen, ...seen];
  })();
  if (ownerBubble.pinFirst && owner.length > 0) {
    return [...owner, ...orderedRest];
  }
  if (!unseenFirst) return users.slice();
  const unseen = users.filter((u) => !isUserSeen(u, s));
  const seen = users.filter((u) => isUserSeen(u, s));
  return [...unseen, ...seen];
}
