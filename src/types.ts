export type PaletteName =
  'classic' | 'ocean' | 'sunset' | 'mono' | 'closeFriends';

export type MediaType = 'image' | 'video';

export interface StoryItem {
  id: string;
  type: MediaType;
  uri: string;
  durationMs?: number;
  thumbhash?: string;
  thumbnail?: string;
  colors?: string[];
  alt?: string;
  seen?: boolean;
  createdAt?: number;
  data?: unknown;
}

export interface StoryUser {
  id: string;
  name: string;
  avatar: string;
  stories: StoryItem[];
  ringVariant?: PaletteName;
  ringColors?: string[];
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ColorScheme = 'light' | 'dark';

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[]
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export interface StoryTheme {
  ring: {
    width: number;
    gap: number;
    sizes: { sm: number; md: number; lg: number };
    seen: string;
    seenWidth: number;
    palette: PaletteName | string[];
  };
  progress: {
    height: number;
    gap: number;
    radius: number;
    topInset: number;
    sideInset: number;
    track: string;
    fill: string;
  };
  header: {
    avatar: number;
    gapAvatarName: number;
    marginTop: number;
    sideInset: number;
    name: { size: number; weight: string; lineHeight: number; color: string };
    time: {
      size: number;
      weight: string;
      lineHeight: number;
      color: string;
      marginLeft: number;
    };
    closeBtn: {
      icon: number;
      hit: { w: number; h: number };
      stroke: number;
      color: string;
      right: number;
    };
    shadow: { color: string; radius: number; offsetY: number };
  };
  viewer: { bgFallback: string; dismissBg: string };
  loading: {
    size: number;
    stroke: number;
    color: string;
    trackColor: string;
    rotationMs: number;
    showAfterMs: number;
  };
  list: {
    bubble: number;
    itemWidth: number;
    gap: number;
    paddingH: number;
    name: {
      size: number;
      weight: string;
      lineHeight: number;
      color: string;
      seenColor: string;
      marginTop: number;
      maxWidth: number;
      lines: number;
      ellipsizeMode: 'head' | 'middle' | 'tail' | 'clip';
      align: 'left' | 'center' | 'right';
    };
  };
  avatarPlaceholder: string;
}
