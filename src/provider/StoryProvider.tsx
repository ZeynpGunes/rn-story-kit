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
  StoryPerson,
  StoryTheme,
  StoryUser,
} from '../types';
import { sortUsers, visibleUsers } from '../seen/selectors';
import { shouldShowDefaultFooter } from '../viewer/DefaultFooter';
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
  onLike?(story: StoryItem, user: StoryUser, nextLiked: boolean): void;
  onSendMessage?(story: StoryItem, user: StoryUser, text: string): void;
  onVoice?(story: StoryItem, user: StoryUser): void;
  onShare?(story: StoryItem, user: StoryUser): void;
  onFollow?(person: StoryPerson): void;
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

export interface ViewerCommands {
  next(): void;
  prev(): void;
  pause(): void;
  resume(): void;
  goToUser(userId: string): void;
}

export interface StoryContextValue {
  users: StoryUser[];
  config: StoryConfig;
  scheme: ColorScheme;
  store: SeenStore;
  registry: RectRegistry;
  /**
   * Open viewer session. users keeps the order fixed at open; later `users`
   * prop updates only remove or append entries.
   */
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
  /** Internal: stable engagement callbacks for the default footer. */
  onLike(story: StoryItem, user: StoryUser, nextLiked: boolean): void;
  onSendMessage(story: StoryItem, user: StoryUser, text: string): void;
  onVoice(story: StoryItem, user: StoryUser): void;
  onShare(story: StoryItem, user: StoryUser): void;
  onFollow(person: StoryPerson): void;
  /** Internal: the mounted viewer registers its close routine here. */
  closerRef: { current: (() => void) | null };
  /** Internal: the mounted viewer registers its imperative commands here. */
  commandsRef: { current: ViewerCommands | null };
  /** Internal: stable; undefined when the app gave no renderHeader. */
  renderHeader(p: StorySlotProps): ReactNode | undefined;
  /** Internal: stable; render the app's footer / overlay slots. */
  renderFooter(p: StorySlotProps): ReactNode;
  renderOverlay(p: StorySlotProps): ReactNode;
  hasFooter: boolean;
  hasOverlay: boolean;
  /** Internal: whether the app gave a renderHeader. */
  hasCustomHeader: boolean;
  /** Internal: whether the app gave a renderFooter (replaces the default). */
  hasCustomFooter: boolean;
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

  const [session, setSession] = useState<{
    userId: string;
    rect: Rect | null;
    order: string[];
  } | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const onSwipeUp = useCallback(
    (story: StoryItem, user: StoryUser) =>
      latest.current.onSwipeUp?.(story, user),
    []
  );
  const onLike = useCallback(
    (story: StoryItem, user: StoryUser, nextLiked: boolean) =>
      latest.current.onLike?.(story, user, nextLiked),
    []
  );
  const onSendMessage = useCallback(
    (story: StoryItem, user: StoryUser, text: string) =>
      latest.current.onSendMessage?.(story, user, text),
    []
  );
  const onVoice = useCallback(
    (story: StoryItem, user: StoryUser) =>
      latest.current.onVoice?.(story, user),
    []
  );
  const onShare = useCallback(
    (story: StoryItem, user: StoryUser) =>
      latest.current.onShare?.(story, user),
    []
  );
  const onFollow = useCallback(
    (person: StoryPerson) => latest.current.onFollow?.(person),
    []
  );

  const mergedConfig = useMemo(() => {
    const merged = deepMerge(defaultConfig, config) as StoryConfig;
    // Guarantee a full strings table even if a host passes a sparse override
    // through a path that skips deepMerge on nested keys.
    merged.strings = {
      ...defaultConfig.strings,
      ...(config?.strings ?? {}),
    };
    return merged;
  }, [config]);

  // Open order, updated with removals and appends; never re-sorted.
  const orderRef = useRef<string[]>([]);
  const opened = useMemo<StoryContextValue['opened']>(() => {
    if (!session) return null;
    const visible = visibleUsers(users);
    const byId = new Map(visible.map((u) => [u.id, u]));
    const kept = orderRef.current.filter((id) => byId.has(id));
    const added = visible.filter((u) => !kept.includes(u.id)).map((u) => u.id);
    orderRef.current = [...kept, ...added];
    const live = orderRef.current.map((id) => byId.get(id)!);
    return {
      userId: session.userId,
      rect: session.rect,
      users: live,
      userIndex: live.findIndex((u) => u.id === session.userId),
    };
  }, [session, users]);

  const openedRef = useRef(session);
  const closerRef = useRef<(() => void) | null>(null);
  const commandsRef = useRef<ViewerCommands | null>(null);

  const api = useMemo<StoryViewerApi>(
    () => ({
      open: (userId, rect) => {
        // openedRef flips synchronously so a second open() in the same tick
        // cannot slip through before React re-renders.
        if (openedRef.current) return;
        const ordered = sortUsers(
          visibleUsers(latest.current.users),
          store,
          mergedConfig.sortUnseenFirst
        );
        const userIndex = ordered.findIndex((u) => u.id === userId);
        if (userIndex === -1) return;
        const next = {
          userId,
          rect: rect ?? null,
          order: ordered.map((u) => u.id),
        };
        orderRef.current = next.order;
        openedRef.current = next;
        setSession(next);
        latest.current.onOpen?.(userId);
      },
      close: () => closerRef.current?.(),
      next: () => commandsRef.current?.next(),
      prev: () => commandsRef.current?.prev(),
      pause: () => commandsRef.current?.pause(),
      resume: () => commandsRef.current?.resume(),
      goToUser: (userId) => commandsRef.current?.goToUser(userId),
      isOpen: session !== null,
    }),
    [session, store, mergedConfig.sortUnseenFirst]
  );

  const renderHeader = useCallback(
    (p: StorySlotProps) => latest.current.renderHeader?.(p),
    []
  );

  const renderFooter = useCallback(
    (p: StorySlotProps) => latest.current.renderFooter?.(p),
    []
  );
  const renderOverlay = useCallback(
    (p: StorySlotProps) => latest.current.renderOverlay?.(p),
    []
  );

  const hasCustomHeader = props.renderHeader !== undefined;
  const hasCustomFooter = props.renderFooter !== undefined;
  const hasFooter =
    hasCustomFooter || shouldShowDefaultFooter(users, mergedConfig.actions);
  const hasOverlay = props.renderOverlay !== undefined;

  const onViewerClosed = useCallback(() => {
    openedRef.current = null;
    setSession(null);
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
      onLike,
      onSendMessage,
      onVoice,
      onShare,
      onFollow,
      closerRef,
      commandsRef,
      renderHeader,
      renderFooter,
      renderOverlay,
      hasFooter,
      hasOverlay,
      hasCustomHeader,
      hasCustomFooter,
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
      onLike,
      onSendMessage,
      onVoice,
      onShare,
      onFollow,
      renderHeader,
      renderFooter,
      renderOverlay,
      hasFooter,
      hasOverlay,
      hasCustomHeader,
      hasCustomFooter,
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
