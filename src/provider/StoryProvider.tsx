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
import { sortUsers, visibleUsers } from '../seen/selectors';
import { StoryViewer } from '../viewer/StoryViewer';
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
  /** Open viewer session; users is the ordered snapshot taken at open. */
  opened: {
    userId: string;
    rect: Rect | null;
    users: StoryUser[];
    userIndex: number;
  } | null;
  /** Bubble to render invisible while the viewer is open (active user). */
  hiddenUserId: string | null;
  /** Internal: the viewer reports its active user here. */
  onActiveUserChange(userId: string): void;
  /** Internal: stable; always calls the latest onSwipeUp prop. */
  onSwipeUp(story: StoryItem, user: StoryUser): void;
  /** Internal: the mounted viewer registers its close routine here. */
  closerRef: { current: (() => void) | null };
  /** Internal: stable; undefined when the app gave no renderHeader. */
  renderHeader(p: StorySlotProps): ReactNode | undefined;
  /** Internal: called by the viewer after its close animation ended. */
  onViewerClosed(): void;
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
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const onSwipeUp = useCallback(
    (story: StoryItem, user: StoryUser) =>
      latest.current.onSwipeUp?.(story, user),
    []
  );

  const mergedConfig = useMemo(
    () => deepMerge(defaultConfig, config) as StoryConfig,
    [config]
  );

  const openedRef = useRef(opened);
  openedRef.current = opened;
  const closerRef = useRef<(() => void) | null>(null);

  const api = useMemo<StoryViewerApi>(
    () => ({
      open: (userId, rect) => {
        if (openedRef.current) return;
        const ordered = sortUsers(
          visibleUsers(latest.current.users),
          store,
          mergedConfig.sortUnseenFirst
        );
        const userIndex = ordered.findIndex((u) => u.id === userId);
        if (userIndex === -1) return;
        setOpened({ userId, rect: rect ?? null, users: ordered, userIndex });
        latest.current.onOpen?.(userId);
      },
      close: () => closerRef.current?.(),
      next: noop,
      prev: noop,
      pause: noop,
      resume: noop,
      goToUser: noop,
      isOpen: opened !== null,
    }),
    [opened, store, mergedConfig.sortUnseenFirst]
  );

  const renderHeader = useCallback(
    (p: StorySlotProps) => latest.current.renderHeader?.(p),
    []
  );

  const onViewerClosed = useCallback(() => {
    setOpened(null);
    setActiveUserId(null);
    latest.current.onClose?.();
  }, []);

  const value = useMemo<StoryContextValue>(
    () => ({
      users,
      config: mergedConfig,
      scheme,
      store,
      registry,
      opened,
      hiddenUserId: opened ? (activeUserId ?? opened.userId) : null,
      onActiveUserChange: setActiveUserId,
      onSwipeUp,
      closerRef,
      renderHeader,
      onViewerClosed,
      api,
      onEndReached,
    }),
    [
      users,
      mergedConfig,
      scheme,
      store,
      registry,
      opened,
      activeUserId,
      onSwipeUp,
      renderHeader,
      onViewerClosed,
      api,
      onEndReached,
    ]
  );

  return (
    <StoryThemeProvider theme={theme} scheme={scheme}>
      <StoryContext.Provider value={value}>
        {children}
        {opened && (
          <StoryViewer
            initialUserIndex={opened.userIndex}
            sourceRect={opened.rect}
            onClosed={onViewerClosed}
          />
        )}
      </StoryContext.Provider>
    </StoryThemeProvider>
  );
}
