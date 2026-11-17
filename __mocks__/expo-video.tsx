import { useEffect, useState } from 'react';
import { View } from 'react-native';

type Listener = (payload: unknown) => void;

export interface MockPlayer {
  source: unknown;
  status: string;
  duration: number;
  playing: boolean;
  muted: boolean;
  loop: boolean;
  currentTime: number;
  released: boolean;
  play: jest.Mock;
  pause: jest.Mock;
  release: jest.Mock;
  replace: jest.Mock;
  addListener: jest.Mock;
  emit(event: string, payload?: unknown): void;
}

/** Every player created since the last __reset(); one entry per instance. */
export const __players: MockPlayer[] = [];

export function __reset() {
  __players.length = 0;
}

function createPlayer(source: unknown): MockPlayer {
  const listeners: Record<string, Set<Listener>> = {};
  const player: MockPlayer = {
    source,
    status: 'idle',
    duration: 0,
    playing: false,
    muted: false,
    loop: false,
    currentTime: 0,
    released: false,
    play: jest.fn(() => {
      player.playing = true;
    }),
    pause: jest.fn(() => {
      player.playing = false;
    }),
    release: jest.fn(() => {
      player.released = true;
    }),
    replace: jest.fn((next: unknown) => {
      player.source = next;
    }),
    addListener: jest.fn((event: string, fn: Listener) => {
      (listeners[event] ??= new Set()).add(fn);
      return { remove: () => listeners[event]?.delete(fn) };
    }),
    emit(event, payload) {
      listeners[event]?.forEach((fn) => fn(payload));
    },
  };
  __players.push(player);
  return player;
}

export const VideoView = View;

export function useVideoPlayer(
  source: unknown,
  setup?: (p: MockPlayer) => void
) {
  const [player] = useState(() => {
    const p = createPlayer(source);
    setup?.(p);
    return p;
  });
  useEffect(() => () => player.release(), [player]);
  return player;
}
