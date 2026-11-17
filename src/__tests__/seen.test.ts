import type { StoryItem, StoryUser } from '../types';
import {
  createAsyncStorageSeenStorage,
  createMemorySeenStorage,
  createMMKVSeenStorage,
} from '../seen/adapters';
import { SeenStore } from '../seen/SeenStore';
import {
  firstUnseenIndex,
  isUserSeen,
  sortUsers,
  visibleUsers,
} from '../seen/selectors';

const story = (id: string, seen?: boolean): StoryItem => ({
  id,
  type: 'image',
  uri: `https://x/${id}.jpg`,
  seen,
});
const user = (id: string, stories: StoryItem[]): StoryUser => ({
  id,
  name: id,
  avatar: 'a',
  stories,
});

describe('SeenStore', () => {
  it('markSeen returns true once and fires onSeen once', () => {
    const onSeen = jest.fn();
    const s = new SeenStore({ onSeen });
    expect(s.markSeen('a', 'u1')).toBe(true);
    expect(s.markSeen('a', 'u1')).toBe(false);
    expect(onSeen).toHaveBeenCalledTimes(1);
    expect(onSeen).toHaveBeenCalledWith('a', 'u1');
  });

  it('treats story.seen flag as seen without markSeen', () => {
    const s = new SeenStore();
    expect(s.isSeen(story('b', true))).toBe(true);
    expect(s.isSeen(story('b'))).toBe(false);
  });

  it('flagged story not in set: markSeen adds and fires once', () => {
    const onSeen = jest.fn();
    const s = new SeenStore({ onSeen });
    expect(s.markSeen('b', 'u1')).toBe(true);
    expect(onSeen).toHaveBeenCalledTimes(1);
  });

  it('initialSeen is seen and does not fire onSeen', () => {
    const onSeen = jest.fn();
    const s = new SeenStore({ initialSeen: ['c'], onSeen });
    expect(s.isSeen(story('c'))).toBe(true);
    expect(s.markSeen('c', 'u1')).toBe(false);
    expect(onSeen).not.toHaveBeenCalled();
  });

  it('hydrate loads ids from storage', async () => {
    const storage = createMemorySeenStorage();
    await storage.add(['d']);
    const s = new SeenStore({ storage });
    expect(s.isSeen(story('d'))).toBe(false);
    await s.hydrate();
    expect(s.isSeen(story('d'))).toBe(true);
  });

  it('hydrate swallows storage errors', async () => {
    const s = new SeenStore({
      storage: {
        getAll: () => Promise.reject(new Error('boom')),
        add: () => undefined,
      },
    });
    await expect(s.hydrate()).resolves.toBeUndefined();
  });

  it('markSeen survives storage.add failure', async () => {
    const s = new SeenStore({
      storage: { getAll: () => [], add: () => Promise.reject(new Error('x')) },
    });
    expect(s.markSeen('a', 'u')).toBe(true);
    await Promise.resolve();
    expect(s.isSeen(story('a'))).toBe(true);
  });

  it('subscribe fires on change, not on duplicate; unsubscribe stops', () => {
    const s = new SeenStore();
    const fn = jest.fn();
    const off = s.subscribe(fn);
    const v = s.getVersion();
    s.markSeen('a', 'u');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(s.getVersion()).toBe(v + 1);
    s.markSeen('a', 'u');
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    s.markSeen('b', 'u');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('adapters', () => {
  it('MMKV writes JSON array under default key and merges', () => {
    const data: Record<string, string> = {};
    const mmkv = {
      getString: (k: string) => data[k],
      set: jest.fn((k: string, v: string) => {
        data[k] = v;
      }),
    };
    const s = new SeenStore({ storage: createMMKVSeenStorage(mmkv) });
    s.markSeen('a', 'u1');
    expect(mmkv.set).toHaveBeenCalledWith('rn-story-kit:seen', '["a"]');
    s.markSeen('b', 'u1');
    expect(data['rn-story-kit:seen']).toBe('["a","b"]');
  });

  it('MMKV merges with pre-existing ids and survives corrupt JSON', () => {
    const data: Record<string, string> = { k: '["x"]' };
    const st = createMMKVSeenStorage(
      {
        getString: (k) => data[k],
        set: (k, v) => {
          data[k] = v;
        },
      },
      'k'
    );
    st.add(['a']);
    expect(JSON.parse(data.k!)).toEqual(['x', 'a']);
    data.k = '{oops';
    expect(st.getAll()).toEqual([]);
  });

  it('AsyncStorage adapter persists and merges', async () => {
    const data: Record<string, string> = {};
    const as = {
      getItem: async (k: string) => data[k] ?? null,
      setItem: jest.fn(async (k: string, v: string) => {
        data[k] = v;
      }),
    };
    const st = createAsyncStorageSeenStorage(as);
    await Promise.all([st.add(['a']), st.add(['b'])]);
    expect(data['rn-story-kit:seen']).toBe('["a","b"]');
    expect(await st.getAll()).toEqual(['a', 'b']);
  });

  it('AsyncStorage corrupt JSON gives []', async () => {
    const st = createAsyncStorageSeenStorage({
      getItem: async () => '{oops',
      setItem: async () => undefined,
    });
    expect(await st.getAll()).toEqual([]);
  });

  it('memory storage clear empties', () => {
    const st = createMemorySeenStorage();
    st.add(['a']);
    st.clear?.();
    expect(st.getAll()).toEqual([]);
  });
});

describe('selectors', () => {
  const s = () => new SeenStore({ initialSeen: ['s1', 's2', 'sa', 'sc'] });

  it('firstUnseenIndex', () => {
    const u = user('u', [story('s1'), story('n1'), story('n2')]);
    expect(firstUnseenIndex(u, s())).toBe(1);
    expect(firstUnseenIndex(user('u', [story('s1'), story('s2')]), s())).toBe(
      0
    );
  });

  it('isUserSeen only when every story seen', () => {
    expect(isUserSeen(user('u', [story('s1'), story('s2')]), s())).toBe(true);
    expect(isUserSeen(user('u', [story('s1'), story('n1')]), s())).toBe(false);
  });

  it('visibleUsers drops empty users', () => {
    const a = user('a', [story('x')]);
    expect(visibleUsers([a, user('e', [])])).toEqual([a]);
    expect(visibleUsers([])).toEqual([]);
  });

  it('visibleUsers keeps empty owner when showAddWhenEmpty', () => {
    const owner: StoryUser = { ...user('me', []), isOwner: true };
    const a = user('a', [story('x')]);
    expect(visibleUsers([owner, a]).map((u) => u.id)).toEqual(['me', 'a']);
    expect(
      visibleUsers([owner, a], {
        show: true,
        pinFirst: true,
        showAddWhenEmpty: false,
      })
    ).toEqual([a]);
    expect(
      visibleUsers([owner, a], {
        show: false,
        pinFirst: true,
        showAddWhenEmpty: true,
      })
    ).toEqual([a]);
  });

  it('sortUsers puts unseen first, stable; false keeps order', () => {
    const A = user('A', [story('sa')]);
    const B = user('B', [story('nb')]);
    const C = user('C', [story('sc')]);
    const D = user('D', [story('nd')]);
    const input = [A, B, C, D];
    const ids = (l: StoryUser[]) => l.map((x) => x.id);
    expect(ids(sortUsers(input, s(), true))).toEqual(['B', 'D', 'A', 'C']);
    expect(ids(sortUsers(input, s(), false))).toEqual(['A', 'B', 'C', 'D']);
  });

  it('sortUsers pins owner first when configured', () => {
    const owner: StoryUser = {
      ...user('me', [story('sm')]),
      isOwner: true,
    };
    const B = user('B', [story('nb')]);
    const ids = (l: StoryUser[]) => l.map((x) => x.id);
    expect(ids(sortUsers([B, owner], s(), true))).toEqual(['me', 'B']);
    expect(
      ids(
        sortUsers([B, owner], s(), true, {
          show: true,
          pinFirst: false,
          showAddWhenEmpty: true,
        })
      )
    ).toEqual(['B', 'me']);
  });
});
