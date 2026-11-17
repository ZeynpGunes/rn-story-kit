import { View } from 'react-native';

export const VideoView = View;

export function useVideoPlayer() {
  return {
    play: jest.fn(),
    pause: jest.fn(),
    release: jest.fn(),
    replace: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    currentTime: 0,
    duration: 0,
    muted: false,
    loop: false,
    playing: false,
  };
}
