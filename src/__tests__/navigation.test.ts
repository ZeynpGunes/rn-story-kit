import {
  enterUser,
  reconcileNavState,
  swipeToUser,
  tapNext,
  tapPrev,
} from '../model/navigation';
import { SeenStore } from '../seen/SeenStore';
import type { StoryUser } from '../types';

const mkUser = (id: string, n: number): StoryUser => ({
  id,
  name: id,
  avatar: '',
  stories: Array.from({ length: n }, (_, i) => ({
    id: `${id}s${i}`,
    type: 'image' as const,
    uri: '',
  })),
});

const users = [mkUser('U0', 3), mkUser('U1', 2), mkUser('U2', 1)];
const nav = (userIndex: number, storyIndex: number) => ({
  userIndex,
  storyIndex,
});
const unseen = () => new SeenStore({ initialSeen: [] });

describe('tapNext', () => {
  it('advances within user', () => {
    expect(tapNext(nav(0, 0), users)).toEqual({
      kind: 'story',
      state: nav(0, 1),
    });
  });
  it('moves to next user at last story', () => {
    expect(tapNext(nav(0, 2), users)).toEqual({
      kind: 'user',
      direction: 1,
      state: nav(1, 0),
    });
  });
  it('closes at the very end', () => {
    expect(tapNext(nav(2, 0), users)).toEqual({ kind: 'close' });
  });
});

describe('tapPrev', () => {
  it('goes back within user', () => {
    expect(tapPrev(nav(0, 1), users, {})).toEqual({
      kind: 'story',
      state: nav(0, 0),
    });
  });
  it('restarts at the very first story', () => {
    expect(tapPrev(nav(0, 0), users, {})).toEqual({
      kind: 'restart',
      state: nav(0, 0),
    });
  });
  it('goes to previous user last viewed story', () => {
    expect(tapPrev(nav(1, 0), users, { U0: 1 })).toEqual({
      kind: 'user',
      direction: -1,
      state: nav(0, 1),
    });
  });
  it('goes to previous user last story without history', () => {
    expect(tapPrev(nav(1, 0), users, {})).toEqual({
      kind: 'user',
      direction: -1,
      state: nav(0, 2),
    });
  });
  it('clamps stale lastViewed', () => {
    const r = tapPrev(nav(1, 0), users, { U0: 9 });
    expect(r).toEqual({ kind: 'user', direction: -1, state: nav(0, 2) });
  });
});

describe('enterUser', () => {
  it('starts at first unseen story', () => {
    const seen = new SeenStore({ initialSeen: ['U1s0'] });
    expect(enterUser(1, users, seen)).toEqual(nav(1, 1));
  });
});

describe('swipeToUser', () => {
  it('forward starts at first unseen story', () => {
    const seen = new SeenStore({ initialSeen: ['U1s0'] });
    expect(swipeToUser(nav(0, 1), 1, users, seen)).toEqual({
      kind: 'user',
      direction: 1,
      state: nav(1, 1),
    });
  });
  it('back to fully seen user starts from 0', () => {
    const seen = new SeenStore({ initialSeen: ['U0s0', 'U0s1', 'U0s2'] });
    expect(swipeToUser(nav(1, 0), -1, users, seen)).toEqual({
      kind: 'user',
      direction: -1,
      state: nav(0, 0),
    });
  });
  it('is null at edges', () => {
    expect(swipeToUser(nav(2, 0), 1, users, unseen())).toBeNull();
    expect(swipeToUser(nav(0, 0), -1, users, unseen())).toBeNull();
  });
});

describe('reconcileNavState', () => {
  const rest = users.slice(1);
  it('relocates after a user is removed', () => {
    expect(reconcileNavState({ userId: 'U1', storyId: 'U1s1' }, rest)).toEqual(
      nav(0, 1)
    );
  });
  it('clamps when story is gone', () => {
    expect(reconcileNavState({ userId: 'U1', storyId: 'gone' }, rest)).toEqual(
      nav(0, 1)
    );
  });
  it('returns null when user is gone', () => {
    expect(
      reconcileNavState({ userId: 'U0', storyId: 'U0s0' }, rest)
    ).toBeNull();
  });
});

describe('StoryUser.startIndex', () => {
  const withStart = (startIndex: number | undefined): StoryUser[] => [
    { ...mkUser('U0', 3), startIndex },
    mkUser('U1', 2),
  ];
  const seenAll = () =>
    new SeenStore({ initialSeen: ['U0s0', 'U0s1', 'U1s0'] });

  it('opens at startIndex instead of the first unseen story', () => {
    expect(enterUser(0, withStart(2), unseen())).toEqual(nav(0, 2));
    expect(enterUser(0, withStart(0), seenAll())).toEqual(nav(0, 0));
  });
  it('falls back to the first unseen story when out of range or invalid', () => {
    const store = new SeenStore({ initialSeen: ['U0s0'] });
    for (const bad of [3, -1, 1.5, NaN, undefined]) {
      expect(enterUser(0, withStart(bad), store)).toEqual(nav(0, 1));
    }
  });
  it('applies on a swipe into the user', () => {
    const us = [mkUser('U0', 2), { ...mkUser('U1', 3), startIndex: 1 }];
    expect(swipeToUser(nav(0, 0), 1, us, unseen())).toEqual({
      kind: 'user',
      direction: 1,
      state: nav(1, 1),
    });
  });
});
