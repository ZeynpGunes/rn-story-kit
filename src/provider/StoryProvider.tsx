import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import { defaultConfig, type StoryConfig } from '../config';
import { SeenStore } from '../seen/SeenStore';
import type { SeenStorage } from '../seen/SeenStorage';
import { deepMerge } from '../theme/mergeTheme';
import { StoryThemeProvider } from '../theme/StoryThemeProvider';
import type {
  ColorScheme,
  DeepPartial,
  Rect,
  StoryItem,
  StoryTheme,
  StoryUser,
} from '../types';
import { createRectRegistry, type RectRegistry } from './rectRegistry';

export interface StorySlotProps {
  user: StoryUser;
  story: StoryItem;
  storyIndex: number;
  close(): void;
  pause(): void;
  resume(): void;
}

export interface StoryProviderProps {
  users: StoryUser[];
  theme?: DeepPartial<StoryTheme>;
  scheme?: ColorScheme | 'system';
  config?: DeepPartial<StoryConfig>;
  seenStorage?: SeenStorage;
  initialSeen?: string[];
  onSeen?(storyId: string, userId: string): void;
  onOpen?(userId: string): void;
  onClose?(): void;
  onSwipeUp?(story: StoryItem, user: StoryUser): void;
  onEndReached?(): void;
  renderHeader?(p: StorySlotProps): ReactNode;
  renderFooter?(p: StorySlotProps): ReactNode;
  renderOverlay?(p: StorySlotProps): ReactNode;
  children: ReactNode;
}

export interface StoryViewerApi {
  open(userId: string, rect?: Rect): void;
  close(): void;
  next(): void;
  prev(): void;
  pause(): void;
  resume(): void;
  goToUser(userId: string): void;
  isOpen: boolean;
}

export interface StoryContextValue {
  users: StoryUser[];
  config: StoryConfig;
  scheme: ColorScheme;
  store: SeenStore;
  registry: RectRegistry;
  /** Open request; the overlay that consumes it arrives in Task 8. */
  opened: { userId: string; rect?: Rect } | null;
  api: StoryViewerApi;
  /** Stable; always calls the latest onEndReached prop. */
  onEndReached(): void;
}

const StoryContext = createContext<StoryContextValue | null>(null);

/** Internal: full provider state, for library components. */
export function useStoryContext(): StoryContextValue {
  const ctx = useContext(StoryContext);
  if (!ctx) throw new Error('rn-story-kit: wrap your tree in <StoryProvider>');
  return ctx;
}

export function useSeenStore(): SeenStore {
  return useStoryContext().store;
}

export function useSeenVersion(): number {
  const { store } = useStoryContext();
  const subscribe = useCallback(
    (fn: () => void) => store.subscribe(fn),
    [store]
  );
  const getVersion = useCallback(() => store.getVersion(), [store]);
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}

const noop = () => {};

export function StoryProvider(props: StoryProviderProps) {
  const { users, theme, config, seenStorage, initialSeen, children } = props;
  const system = useColorScheme();
  const scheme: ColorScheme =
    props.scheme === 'dark' || props.scheme === 'light'
      ? props.scheme
      : system === 'dark'
        ? 'dark'
        : 'light';

  const latest = useRef(props);
  latest.current = props;

  const storeRef = useRef<SeenStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = new SeenStore({
      storage: seenStorage,
      initialSeen,
      onSeen: (storyId, userId) => latest.current.onSeen?.(storyId, userId),
    });
  }
  const store = storeRef.current;
  const onEndReached = useCallback(() => latest.current.onEndReached?.(), []);
  const [registry] = useState(createRectRegistry);

  useEffect(() => {
    store.hydrate();
  }, [store]);

  const [opened, setOpened] = useState<StoryContextValue['opened']>(null);

  const api = useMemo<StoryViewerApi>(
    () => ({
      open: (userId, rect) => {
        setOpened({ userId, rect });
        latest.current.onOpen?.(userId);
      },
      close: () => {
        setOpened(null);
        latest.current.onClose?.();
      },
      next: noop,
      prev: noop,
      pause: noop,
      resume: noop,
      goToUser: noop,
      isOpen: opened !== null,
    }),
    [opened]
  );

  const mergedConfig = useMemo(
    () => deepMerge(defaultConfig, config) as StoryConfig,
    [config]
  );

  const value = useMemo<StoryContextValue>(
    () => ({
      users,
      config: mergedConfig,
      scheme,
      store,
      registry,
      opened,
      api,
      onEndReached,
    }),
    [users, mergedConfig, scheme, store, registry, opened, api, onEndReached]
  );

  return (
    <StoryThemeProvider theme={theme} scheme={scheme}>
      <StoryContext.Provider value={value}>{children}</StoryContext.Provider>
    </StoryThemeProvider>
  );
}
