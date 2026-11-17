import type { StoryTheme } from '../types';

const base: StoryTheme = {
  ring: {
    width: 2.5,
    gap: 3,
    sizes: { sm: 44, md: 64, lg: 76 },
    seen: '#C9CCD1',
    seenWidth: 1.5,
    palette: 'classic',
  },
  progress: {
    height: 2.5,
    gap: 3,
    radius: 1.25,
    topInset: 8,
    sideInset: 8,
    track: 'rgba(255,255,255,0.38)',
    fill: '#FFFFFF',
  },
  header: {
    avatar: 32,
    gapAvatarName: 10,
    marginTop: 10,
    sideInset: 12,
    name: { size: 14, weight: '600', lineHeight: 18, color: '#FFF' },
    time: {
      size: 13,
      weight: '400',
      lineHeight: 18,
      color: 'rgba(255,255,255,0.72)',
      marginLeft: 8,
    },
    closeBtn: {
      icon: 24,
      hit: { w: 44, h: 44 },
      stroke: 2,
      color: '#FFF',
      right: 4,
    },
    shadow: { color: 'rgba(0,0,0,0.35)', radius: 3, offsetY: 1 },
  },
  viewer: { bgFallback: '#111214', dismissBg: '#000' },
  loading: {
    size: 28,
    stroke: 2,
    color: 'rgba(255,255,255,0.85)',
    trackColor: 'rgba(255,255,255,0.2)',
    rotationMs: 900,
    showAfterMs: 250,
  },
  list: {
    bubble: 64,
    itemWidth: 84,
    gap: 4,
    paddingH: 12,
    name: {
      size: 12,
      weight: '400',
      lineHeight: 16,
      color: '#1C1C1E',
      seenColor: '#6B6F76',
      marginTop: 6,
      maxWidth: 76,
      lines: 1,
      ellipsizeMode: 'tail',
      align: 'center',
    },
  },
  avatarPlaceholder: '#E4E6EA',
};

export const lightTheme: StoryTheme = base;

export const darkTheme: StoryTheme = {
  ...base,
  ring: { ...base.ring, seen: '#4A4D55' },
  progress: { ...base.progress, track: 'rgba(255,255,255,0.30)' },
  viewer: { ...base.viewer, bgFallback: '#000000' },
  list: {
    ...base.list,
    name: { ...base.list.name, color: '#F2F2F7', seenColor: '#9A9DA5' },
  },
  avatarPlaceholder: '#2A2C31',
};
