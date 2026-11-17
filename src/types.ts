export type PaletteName =
  'classic' | 'ocean' | 'sunset' | 'mono' | 'closeFriends';

export type MediaType = 'image' | 'video';

/** A person shown in the viewers / likers modal. */
export interface StoryPerson {
  id: string;
  name: string;
  avatar: string;
  /** When false/omitted, a Follow button is shown in the people list. */
  following?: boolean;
}

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
  /** How many people viewed this story (owner insights). */
  viewCount?: number;
  /** How many people liked this story (owner insights). */
  likeCount?: number;
  /** People who viewed this story; shown when the view count is tapped. */
  viewers?: StoryPerson[];
  /** People who liked this story; shown when the like count is tapped. */
  likers?: StoryPerson[];
  /** Whether the current viewer has liked this story. */
  liked?: boolean;
}

export interface StoryUser {
  id: string;
  name: string;
  avatar: string;
  stories: StoryItem[];
  ringVariant?: PaletteName;
  ringColors?: string[];
  /** Marks the signed-in user's row; shows view/like insights instead of the action bar. */
  isOwner?: boolean;
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
  actions: {
    sideInset: number;
    gap: number;
    input: {
      height: number;
      radius: number;
      paddingH: number;
      bg: string;
      border: string;
      color: string;
      placeholder: string;
      size: number;
    };
    icon: { size: number; color: string; hit: number; liked: string };
    count: {
      size: number;
      weight: string;
      lineHeight: number;
      color: string;
      gap: number;
      icon: number;
    };
    modal: {
      bg: string;
      handle: string;
      titleSize: number;
      titleColor: string;
      nameSize: number;
      nameColor: string;
      emptyColor: string;
      avatar: number;
      rowGap: number;
      closeColor: string;
      follow: {
        height: number;
        paddingH: number;
        radius: number;
        bg: string;
        color: string;
        size: number;
        weight: string;
      };
      likedIcon: number;
      likedColor: string;
    };
  };
}
