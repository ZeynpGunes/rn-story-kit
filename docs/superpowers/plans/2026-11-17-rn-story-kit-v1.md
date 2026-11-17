# rn-story-kit v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `rn-story-kit`, a from-scratch React Native story library with an Instagram-grade viewer, a bubble list, persistent seen state, themeable ring palettes, media-derived backgrounds and thumbhash placeholders.

**Architecture:** All behaviour decisions live in pure, fully unit-tested TypeScript modules: navigation reducer, gesture math, colour math, seen store. Thin React components wire those modules to Reanimated 4 shared values and Gesture Handler v3 hook gestures, so every animation runs on the UI thread. A root `StoryProvider` owns the seen store, the bubble-rect registry and a full-screen overlay viewer (no RN `Modal`).

**Tech Stack:** TypeScript strict; react-native-builder-bob 0.44.1 (scaffolded with create-react-native-library 0.64.0); react-native-reanimated 4.7.2 + react-native-worklets 0.13.1; react-native-gesture-handler 3.5.0 (hook API: `usePanGesture`, `useTapGesture`, `useLongPressGesture`, `useCompetingGestures`, `useExclusiveGestures`); react-native-svg 15.16.1; expo-image 58.x; expo-video 58.x; thumbhash 0.1.1; jest + @testing-library/react-native 14.1.0; example app on Expo SDK 58 (dev build).

**Spec:**
- `docs/superpowers/specs/2026-11-17-rn-story-kit-design.md` (behaviour, Turkish)
- `docs/superpowers/specs/2026-11-17-rn-story-kit-visual-motion.md` (every number for tokens and motion)

Executors read both. Where this plan says "per visual spec §N", the exact values are in that file.

## Global Constraints

- New Architecture only. Peers: `react-native-reanimated >=4.1.0`, `react-native-worklets >=0.5.0`, `react-native-gesture-handler >=3.0.0`, `react-native-svg >=15.0.0`, `expo-image *`, `expo-video *`, `react-native-safe-area-context >=5.0.0`. MMKV and AsyncStorage are NOT peers: adapters take an injected instance.
- No code, API or structure taken from any other story library. Do not read sibling folders under `~/Documents/GitHub`.
- Use the Gesture Handler v3 hook API, not the deprecated `Gesture.*` builders. Use `scheduleOnRN` from `react-native-worklets`, not `runOnJS`.
- No RN `Modal`. The viewer renders as an absolute-fill overlay inside `StoryProvider`.
- Photo default duration 5000 ms. Tap zone ratio 0.3 (left 30% = previous).
- Closing happens only by drag-down or the X button. Horizontal drag never closes.
- At most 3 user pages mounted (prev, active, next). At most 2 live video players.
- `onSeen` fires at most once per story id per store lifetime.
- All motion and token numbers come from the visual spec; expose them as overridable defaults in `src/config.ts` and `src/theme/tokens.ts`.
- Pure modules (`src/model/*`, `src/color/*`, `src/seen/*`) must not import `react-native`. Gesture math functions are marked `'worklet'`.
- Branch: `feat/v1`. Conventional commits. Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Empty data:** a user with 0 stories, or an empty `users` array. Expected: the user is filtered out of list and viewer, and an empty list renders nothing without crashing. Tested in Task 4 (`sortUsers`/`visibleUsers`) and Task 7.
2. **Data changes while the viewer is open:** `users` prop updates, e.g. after `onEndReached` appends users or a story is removed. Expected: the active user/story is kept by id, not by index; if the active story disappears, go to the nearest valid one. Tested in Task 5 (`reconcileNavState`).
3. **Media failure:** an image/video URL fails to load. Expected: show the placeholder/background, hold progress for at most 4000 ms, then auto-advance; never mark the story seen. Tested in Task 9 and Task 10.
4. **Rapid input:** fast double taps on the last story, or a tap during a running cube transition. Expected: no skipped users, no double `onClose`; input is ignored while a transition is in flight. Tested in Task 11 (`isTransitioning` gate) and Task 5.
5. **Unknown thumbhash/colour input:** a malformed base64 thumbhash or invalid hex in `colors`. Expected: fall back to the theme `bgFallback`, no throw. Tested in Task 3.

---

## File Structure

```
src/
  index.ts                     public exports
  types.ts                     StoryItem, StoryUser, Rect, PaletteName, callbacks
  config.ts                    StoryConfig defaults (motion + behaviour numbers)
  theme/tokens.ts              lightTheme, darkTheme (StoryTheme)
  theme/palettes.ts            palettes record
  theme/mergeTheme.ts          deep merge of partial overrides
  theme/StoryThemeProvider.tsx context + useStoryTheme()
  color/colorMath.ts           hex/rgb, mix, saturate, clampLightness
  color/thumbhash.ts           base64ToBytes, averageColorFromThumbhash, mediaGradient
  seen/SeenStorage.ts          interface + createMemorySeenStorage
  seen/adapters.ts             createMMKVSeenStorage, createAsyncStorageSeenStorage
  seen/SeenStore.ts            SeenStore class
  seen/selectors.ts            isUserSeen, firstUnseenIndex, visibleUsers, sortUsers
  model/navigation.ts          nav reducer (tap next/prev, goToUser, reconcile)
  model/gestureMath.ts         rubberBand, swipe/dismiss decisions, cube transforms
  provider/StoryProvider.tsx   context, overlay mount, imperative API
  provider/rectRegistry.ts     bubble rect registry
  provider/useStoryViewer.ts   public hook
  list/StoryRing.tsx  list/StoryBubble.tsx  list/StoryList.tsx
  viewer/StoryViewer.tsx       overlay root: open/close anim, pans, cube pages
  viewer/UserPage.tsx          one user: progress, media, header, tap/long-press
  viewer/ProgressBar.tsx
  viewer/useStoryTimer.ts
  viewer/Header.tsx  viewer/Scrim.tsx  viewer/LoadingIndicator.tsx
  viewer/media/ImageMedia.tsx  viewer/media/VideoMedia.tsx
  viewer/media/MediaBackground.tsx  viewer/media/preload.ts
  viewer/a11y.ts               label builders
src/__tests__/...              mirrors src
example/                       Expo SDK 58 app (dev build)
```

---

### Task 1: Scaffold library, example and test harness

**Files:**
- Create: whole repo scaffold (`package.json`, `tsconfig.json`, `babel.config.js`, `jest.config.js`, `jest.setup.ts`, `eslint.config.mjs`, `.github/workflows/ci.yml`, `example/`)
- Test: `src/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: scripts `yarn test`, `yarn typecheck`, `yarn lint`, `yarn example start`. Jest setup that loads the Reanimated (`setUpTests()`), Gesture Handler (`react-native-gesture-handler/jestSetup`) and expo-video/expo-image mocks for all later tasks.

- [ ] **Step 1:** Create branch `feat/v1`. Run `npx create-react-native-library@0.64.0 rn-story-kit` (JS-only library, Expo example). Merge its output into the existing repo; keep `docs/`.
- [ ] **Step 2:** Add peers and devDeps at the versions in Tech Stack. Babel plugin `react-native-worklets/plugin` last. Jest `resolver: 'react-native-reanimated/jest/resolver'`; `jest.setup.ts` calls `require('react-native-reanimated').setUpTests()` and `jest.mock('expo-video')` / `jest.mock('expo-image')` with minimal manual mocks in `__mocks__/`.
- [ ] **Step 3:** Write `smoke.test.ts`: renders `<View testID="x"/>` inside `GestureHandlerRootView` with RNTL and asserts `getByTestId('x')`. Also asserts `withTiming` resolves under `jest.useFakeTimers()` + `advanceAnimationByTime(300)` on an `Animated.View` (`toHaveAnimatedStyle({opacity: 1})`).
- [ ] **Step 4:** Run `yarn test && yarn typecheck && yarn lint`. Expected: all pass.
- [ ] **Step 5:** Run `yarn example ios` with an Expo dev build. Expected: example boots to a blank screen without redbox. Commit `chore: scaffold rn-story-kit library and example`.

### Task 2: Types, config, theme tokens, palettes, theme provider

**Files:**
- Create: `src/types.ts`, `src/config.ts`, `src/theme/tokens.ts`, `src/theme/palettes.ts`, `src/theme/mergeTheme.ts`, `src/theme/StoryThemeProvider.tsx`
- Test: `src/__tests__/theme.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  type PaletteName = 'classic' | 'ocean' | 'sunset' | 'mono' | 'closeFriends';
  type MediaType = 'image' | 'video';
  interface StoryItem { id: string; type: MediaType; uri: string; durationMs?: number; thumbhash?: string; thumbnail?: string; colors?: string[]; alt?: string; seen?: boolean; createdAt?: number; data?: unknown }
  interface StoryUser { id: string; name: string; avatar: string; stories: StoryItem[]; ringVariant?: PaletteName; ringColors?: string[] }
  interface Rect { x: number; y: number; width: number; height: number }
  type ColorScheme = 'light' | 'dark';
  interface StoryTheme { /* exactly the token shape in visual spec §1, with light/dark pairs resolved by scheme */ }
  type DeepPartial<T>
  const lightTheme: StoryTheme; const darkTheme: StoryTheme;
  const palettes: Record<PaletteName, { light: string[]; dark: string[] }>;
  function mergeTheme(base: StoryTheme, override?: DeepPartial<StoryTheme>): StoryTheme;
  function StoryThemeProvider(p: { theme?: DeepPartial<StoryTheme>; scheme?: ColorScheme | 'system'; children }): JSX.Element;
  function useStoryTheme(): StoryTheme;
  interface StoryConfig { imageDurationMs: 5000; tapZoneRatio: 0.3; sortUnseenFirst: true; autoAdvanceWithScreenReader: false; mediaErrorAdvanceMs: 4000; motion: {/* every number in visual spec §4 */} }
  const defaultConfig: StoryConfig;
  ```
  `StoryTheme` has `ring.palette: PaletteName | string[]` (custom stops allowed).

- [ ] **Step 1: Failing tests.**
  - `palettes.classic.light` equals `['#FFC247','#FF8A3D','#F2475F','#C73CA8','#FFC247']`.
  - `palettes.mono.dark` equals `['#FFFFFF','#8E9097','#FFFFFF']`.
  - `lightTheme.ring.seen` is `'#C9CCD1'` and `darkTheme.ring.seen` is `'#4A4D55'`.
  - `mergeTheme(lightTheme, {ring:{width:4}})` gives `ring.width === 4`, `ring.gap === 3`, and does not mutate `lightTheme`.
  - `useStoryTheme()` inside `<StoryThemeProvider scheme="dark">` returns `ring.seen === '#4A4D55'`.
  - `defaultConfig.motion.swipeCommitDistanceRatio === 0.33` and `defaultConfig.motion.swipeCommitVelocity === 600`.
- [ ] **Step 2:** Run `yarn test theme`. Expected: FAIL (modules missing).
- [ ] **Step 3:** Implement. `scheme: 'system'` uses `useColorScheme()`. Name the motion keys after the visual spec terms (`dismissCommitDistance: 120`, `dismissCommitVelocity: 800`, `longPressMs: 200`, `cubePerspective: 1000`, `openMs: 380`, `closeMs: 300`, `seenRingMs: 400`, ...), every one from visual spec §4.
- [ ] **Step 4:** Run `yarn test theme && yarn typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(theme): tokens, palettes and theme provider`.

### Task 3: Colour math and thumbhash colours

**Files:**
- Create: `src/color/colorMath.ts`, `src/color/thumbhash.ts`
- Test: `src/__tests__/color.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type RGB = { r: number; g: number; b: number };
  function hexToRgb(hex: string): RGB | null;          // #RGB, #RRGGBB; null if invalid
  function rgbToHex(c: RGB): string;                    // uppercase #RRGGBB, rounded
  function mix(a: RGB, b: RGB, t: number): RGB;         // t=0 → a, t=1 → b
  function saturate(c: RGB, factor: number): RGB;       // HSL S * factor, clamped
  function clampLightness(c: RGB, maxL: number): RGB;   // HSL L ≤ maxL
  function base64ToBytes(b64: string): Uint8Array | null; // own decoder, no atob
  function averageColorFromThumbhash(b64: string): RGB | null;
  function mediaGradient(input: { colors?: string[]; thumbhash?: string }, fallback: string): string[]; // 1–3 hex stops
  ```

- [ ] **Step 1: Failing tests.**
  - `rgbToHex(mix(hexToRgb('#FFFFFF')!, hexToRgb('#000000')!, 0.5))` is `'#808080'`.
  - `rgbToHex(mix(hexToRgb('#FF0000')!, {r:0,g:0,b:0}, 0.25))` is `'#BF0000'`.
  - `hexToRgb('#abc')` is `{r:170,g:187,b:204}`; `hexToRgb('nope')` is `null`.
  - `clampLightness(hexToRgb('#FFFFFF')!, 0.45)` has HSL L ≤ 0.45.
  - `base64ToBytes('AQID')` equals `Uint8Array [1,2,3]`; `base64ToBytes('%%%')` is `null`.
  - Round trip: build an 8×8 solid `#3366CC` RGBA buffer, `rgbaToThumbHash` from the `thumbhash` package, encode it to base64 in the test, then `averageColorFromThumbhash` is within ±8 per channel of `{r:51,g:102,b:204}`.
  - `mediaGradient({colors:['#112233']}, '#000000')` is `['#112233']`.
  - `mediaGradient({thumbhash: <that hash>}, '#000000')` returns 3 stops. Stop 2 equals `mix(stop1, black, 0.25)` and stop 3 equals `mix(stop1, black, 0.55)`.
  - `mediaGradient({thumbhash:'%%%'}, '#111214')` is `['#111214']`.
  - `mediaGradient({colors:['bad']}, '#111214')` is `['#111214']`.
- [ ] **Step 2:** Run `yarn test color`. Expected: FAIL.
- [ ] **Step 3:** Implement. Stop 1 = average colour, then `saturate(×1.1)`, then `clampLightness(0.45)` (visual spec §4). Invalid entries in `colors` are dropped. Keep at most 3.
- [ ] **Step 4:** Run `yarn test color`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(color): colour math and thumbhash-derived gradients`.

### Task 4: Seen storage, store and selectors

**Files:**
- Create: `src/seen/SeenStorage.ts`, `src/seen/adapters.ts`, `src/seen/SeenStore.ts`, `src/seen/selectors.ts`
- Test: `src/__tests__/seen.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface SeenStorage { getAll(): string[] | Promise<string[]>; add(ids: string[]): void | Promise<void>; clear?(): void | Promise<void> }
  function createMemorySeenStorage(): SeenStorage;
  function createMMKVSeenStorage(mmkv: { getString(k: string): string | undefined; set(k: string, v: string): void }, key?: string): SeenStorage;     // default key 'rn-story-kit:seen', JSON array
  function createAsyncStorageSeenStorage(as: { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void> }, key?: string): SeenStorage;
  class SeenStore {
    constructor(o?: { storage?: SeenStorage; initialSeen?: string[]; onSeen?: (storyId: string, userId: string) => void });
    hydrate(): Promise<void>;
    isSeen(story: StoryItem): boolean;            // set membership OR story.seen === true
    markSeen(storyId: string, userId: string): boolean; // true only the first time; persists via storage.add; calls onSeen once
    subscribe(fn: () => void): () => void;
    getVersion(): number;                         // bumps on every change (for useSyncExternalStore)
  }
  function isUserSeen(u: StoryUser, s: SeenStore): boolean;
  function firstUnseenIndex(u: StoryUser, s: SeenStore): number; // 0 if all seen
  function visibleUsers(users: StoryUser[]): StoryUser[];       // drops users with 0 stories
  function sortUsers(users: StoryUser[], s: SeenStore, unseenFirst: boolean): StoryUser[]; // stable
  ```

- [ ] **Step 1: Failing tests.**
  - `markSeen('a','u1')` returns `true` once, then `false`. `onSeen` is called exactly once with `('a','u1')`.
  - `isSeen({...story, id:'b', seen:true})` is `true` without calling `markSeen`.
  - `initialSeen:['c']` makes `c` seen.
  - With `createMemorySeenStorage` holding `['d']`, `await hydrate()` makes `d` seen.
  - The MMKV adapter, given a fake `{getString,set}`, writes `'["a"]'` under `'rn-story-kit:seen'` after `markSeen('a','u1')`.
  - The AsyncStorage adapter works the same way with async fakes. A corrupt stored JSON makes `getAll()` return `[]`.
  - `subscribe` listener fires on `markSeen` and not on a duplicate. The unsubscribe stops it.
  - `firstUnseenIndex` with stories `[seen, unseen, unseen]` is `1`; with all seen it is `0`.
  - `isUserSeen` is `true` only when every story is seen.
  - `visibleUsers` drops a user with `stories: []`; `visibleUsers([])` is `[]`.
  - `sortUsers([seenA, unseenB, seenC, unseenD], s, true)` gives ids `B, D, A, C`; with `false` the input order is kept.
- [ ] **Step 2:** Run `yarn test seen`. Expected: FAIL.
- [ ] **Step 3:** Implement. Storage errors are caught and the in-memory set stays authoritative.
- [ ] **Step 4:** Run `yarn test seen`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(seen): pluggable seen storage, store and selectors`.

### Task 5: Navigation model

**Files:**
- Create: `src/model/navigation.ts`
- Test: `src/__tests__/navigation.test.ts`

**Interfaces:**
- Consumes: `StoryUser`, `SeenStore`, `firstUnseenIndex` (Task 4).
- Produces:
  ```ts
  interface NavState { userIndex: number; storyIndex: number }
  type NavResult =
    | { kind: 'story'; state: NavState }
    | { kind: 'user'; state: NavState; direction: 1 | -1 }
    | { kind: 'restart'; state: NavState }
    | { kind: 'close' };
  function tapNext(s: NavState, users: StoryUser[]): NavResult;
  function tapPrev(s: NavState, users: StoryUser[], lastViewed: Record<string, number>): NavResult;
  function enterUser(userIndex: number, users: StoryUser[], seen: SeenStore): NavState; // storyIndex = firstUnseenIndex
  function swipeToUser(s: NavState, direction: 1 | -1, users: StoryUser[], seen: SeenStore): NavResult | null; // null at edges
  function reconcileNavState(prev: { userId: string; storyId: string }, users: StoryUser[]): NavState | null;
  ```

- [ ] **Step 1: Failing tests.** Fixture: users U0 (3 stories), U1 (2), U2 (1).
  - `tapNext({0,0})` gives `{kind:'story', state:{0,1}}`.
  - `tapNext({0,2})` gives `{kind:'user', direction:1, state:{1, 0}}`.
  - `tapNext({2,0})` gives `{kind:'close'}`.
  - `tapPrev({0,1})` gives `{kind:'story', state:{0,0}}`.
  - `tapPrev({0,0})` gives `{kind:'restart', state:{0,0}}`.
  - `tapPrev({1,0}, lastViewed {U0:1})` gives `{kind:'user', direction:-1, state:{0,1}}`.
  - `tapPrev({1,0}, {})` gives `state:{0,2}` (the last story).
  - `swipeToUser({0,1}, 1)` with U1 story 0 seen gives `state:{1,1}`.
  - `swipeToUser({1,0}, -1)` with every U0 story seen gives `state:{0,0}`: going back to a fully seen user is allowed and starts from 0.
  - `swipeToUser({2,0}, 1)` is `null`; `swipeToUser({0,0}, -1)` is `null`.
  - `reconcileNavState({userId:'U1', storyId:'U1s1'}, usersWithU0Removed)` gives `{0,1}`. If the story id is gone, it gives the same user with `storyIndex` clamped. If the user is gone, it gives `null`.
- [ ] **Step 2:** Run `yarn test navigation`. Expected: FAIL.
- [ ] **Step 3:** Implement as pure functions. They must not import `react-native`.
- [ ] **Step 4:** Run `yarn test navigation`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(model): story navigation reducer`.

### Task 6: Gesture math

**Files:**
- Create: `src/model/gestureMath.ts`
- Test: `src/__tests__/gestureMath.test.ts`

**Interfaces:**
- Consumes: `StoryConfig['motion']` (Task 2).
- Produces (all `'worklet'`):
  ```ts
  function rubberBand(dx: number, width: number, factor?: number /*0.35*/): number;
  function swipeDecision(dx: number, vx: number, width: number, m: Motion): 1 | -1 | 0; // 1 = next user (finger moved left)
  function dismissProgress(dy: number, height: number): number;  // clamp(dy/(0.6h),0,1)
  function shouldDismiss(dy: number, vy: number, m: Motion): boolean;
  function shouldSwipeUp(dy: number, vy: number, m: Motion): boolean;
  function cubeTransform(p: number, width: number, side: 'outgoing' | 'incoming', perspective: number): { transform: object[]; shadeOpacity: number };
  function dismissStyle(p: number): { scale: number; borderRadius: number; bgOpacity: number; uiOpacity: number };
  function lerpRect(a: Rect, b: Rect, t: number): Rect;
  ```

- [ ] **Step 1: Failing tests** (width 400, height 800, default motion):
  - `rubberBand(400, 400)` is `70` (that is `400*0.35/2`). `rubberBand(-400, 400)` is `-70`.
  - `swipeDecision(-140, 0)` is `1` (more than 0.33×400 = 132). `swipeDecision(-100, 0)` is `0`. `swipeDecision(-20, -700)` is `1`. `swipeDecision(-20, 700)` is `0` (velocity against the direction). `swipeDecision(140, 0)` is `-1`.
  - `dismissProgress(240, 800)` is `0.5`; `dismissProgress(-50, 800)` is `0`.
  - `shouldDismiss(121, 0)` is true; `shouldDismiss(50, 801)` is true; `shouldDismiss(50, 0)` is false.
  - `shouldSwipeUp(-81, 0)` is true; `shouldSwipeUp(-10, -701)` is true.
  - `dismissStyle(1)` is `{scale:0.75, borderRadius:40, bgOpacity:0, uiOpacity:0}`. `dismissStyle(0.2).uiOpacity` is `0.4`.
  - `cubeTransform(0, 400, 'incoming', 1000).shadeOpacity` is `0.5`. `cubeTransform(1, ...).shadeOpacity` is `0`. The first transform entry is `{perspective:1000}`.
  - `lerpRect({0,0,64,64},{0,0,400,800},0.5)` is `{0,0,232,432}`.
- [ ] **Step 2:** Run `yarn test gestureMath`. Expected: FAIL.
- [ ] **Step 3:** Implement per visual spec §4 (cube pivot at the shared edge, `rotateY = p*90deg`, mirrored).
- [ ] **Step 4:** Run `yarn test gestureMath`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(model): gesture and transition math`.

### Task 7: StoryRing, StoryBubble, StoryList + provider skeleton

**Files:**
- Create: `src/list/StoryRing.tsx`, `src/list/StoryBubble.tsx`, `src/list/StoryList.tsx`, `src/provider/rectRegistry.ts`, `src/provider/StoryProvider.tsx` (context only; viewer overlay arrives in Task 8), `src/provider/useStoryViewer.ts`, `src/viewer/a11y.ts`
- Test: `src/__tests__/list.test.tsx`

**Interfaces:**
- Consumes: theme (Task 2), SeenStore + selectors (Task 4).
- Produces:
  ```ts
  interface StoryProviderProps {
    users: StoryUser[]; theme?: DeepPartial<StoryTheme>; scheme?: ColorScheme | 'system';
    config?: DeepPartial<StoryConfig>; seenStorage?: SeenStorage; initialSeen?: string[];
    onSeen?(storyId: string, userId: string): void; onOpen?(userId: string): void; onClose?(): void;
    onSwipeUp?(story: StoryItem, user: StoryUser): void; onEndReached?(): void;
    renderHeader?(p: StorySlotProps): ReactNode; renderFooter?(p: StorySlotProps): ReactNode; renderOverlay?(p: StorySlotProps): ReactNode;
    children: ReactNode;
  }
  interface StorySlotProps { user: StoryUser; story: StoryItem; storyIndex: number; close(): void; pause(): void; resume(): void }
  interface StoryViewerApi { open(userId: string, rect?: Rect): void; close(): void; next(): void; prev(): void; pause(): void; resume(): void; goToUser(userId: string): void; isOpen: boolean }
  function useStoryViewer(): StoryViewerApi;
  function useSeenVersion(): number;  // useSyncExternalStore over SeenStore
  interface RectRegistry { register(userId: string, measure: () => Promise<Rect | null>): () => void; measure(userId: string): Promise<Rect | null> }
  function StoryRing(p: { size: 'sm' | 'md' | 'lg' | number; seen: boolean; palette?: PaletteName | string[]; avatar: string; ringId: string }): JSX.Element;
  function StoryList(p?: { style?: ViewStyle; contentContainerStyle?: ViewStyle; ListHeaderComponent?: ReactElement }): JSX.Element;
  ```
  `a11y.ts`: `bubbleLabel(name, seen, count)` returns `"{name}, new story, {n} stories"` or `"{name}, seen, {n} stories"`, plus the labels from visual spec §6.

- [ ] **Step 1: Failing tests.**
  - `StoryList` renders one bubble per visible user, ordered unseen-first, and renders nothing for `users=[]`.
  - Tapping a bubble calls the viewer `open(userId, rect)` (spy via context).
  - A bubble's `accessibilityLabel` is `"Ada, new story, 3 stories"`.
  - After `markSeen` for all of Ada's stories, the label becomes `"Ada, seen, 3 stories"`, and the seen circle's stroke width is `1.5`.
  - `StoryRing` gradient id equals `ring-${ringId}`, so two rings have different ids.
  - `user.ringColors` overrides the theme palette for that bubble only.
  - The `closeFriends` variant uses the stops `['#3DDC84','#12B76A','#7AE582','#12B76A','#3DDC84']`.
  - Calling `onEndReached` from the FlatList end triggers the prop.
- [ ] **Step 2:** Run `yarn test list`. Expected: FAIL.
- [ ] **Step 3:** Implement per visual spec §1–3. The ring is two stacked SVG circles. Seen transition: gradient opacity animated with `useAnimatedProps`, 400 ms. Use a horizontal `FlatList`. Bubbles register `measureInWindow` in the `RectRegistry`. The provider creates the `SeenStore` once and calls `hydrate()` on mount.
- [ ] **Step 4:** Run `yarn test list && yarn typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(list): story rings, bubbles and list`.

### Task 8: Viewer overlay: open/close, header, X button, scrim

**Files:**
- Create: `src/viewer/StoryViewer.tsx` (shell: overlay, open/close animation, one static page), `src/viewer/Header.tsx`, `src/viewer/Scrim.tsx`
- Modify: `src/provider/StoryProvider.tsx` (mount the overlay, implement `open`/`close`)
- Test: `src/__tests__/viewer-shell.test.tsx`

**Interfaces:**
- Consumes: `RectRegistry`, `lerpRect`, `enterUser`, theme, config.
- Produces: `StoryViewer` internal props `{ initialUserIndex: number; sourceRect: Rect | null; onClosed(): void }`. Viewer context `useViewerControls(): { requestClose(): void; isClosing: SharedValue<boolean> }` used by Tasks 9–11.

- [ ] **Step 1: Failing tests.**
  - `open('U1')` renders the overlay with `accessibilityViewIsModal`, showing U1's name and its first unseen story.
  - The X button has `accessibilityLabel "Close stories"` and a hit size of at least 44×44. Pressing it calls `onClose` once after advancing timers by 300 ms.
  - A second press during the close animation does not call `onClose` again.
  - `renderHeader` replaces the default header, and its `close()` closes the viewer.
  - With no source rect, close uses the fade fallback (opacity reaches 0 after 200 ms).
  - The source bubble's opacity is 0 while the viewer is open and is restored after close.
- [ ] **Step 2:** Run `yarn test viewer-shell`. Expected: FAIL.
- [ ] **Step 3:** Implement. Open is 380 ms `Easing.bezier(0.2,0.9,0.2,1)` from the rect; close is 300 ms `Easing.bezier(0.4,0,0.2,1)` back to the bubble's current rect, re-measured at close time. Header `pointerEvents="box-none"`. Scrim per visual spec §6.
- [ ] **Step 4:** Run `yarn test viewer-shell`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(viewer): overlay with open/close animation and header`.

### Task 9: UserPage: progress timer, tap zones, long-press, image media, seen

**Files:**
- Create: `src/viewer/UserPage.tsx`, `src/viewer/ProgressBar.tsx`, `src/viewer/useStoryTimer.ts`, `src/viewer/media/ImageMedia.tsx`, `src/viewer/media/MediaBackground.tsx`, `src/viewer/LoadingIndicator.tsx`
- Modify: `src/viewer/StoryViewer.tsx` (render `UserPage` for the active user)
- Test: `src/__tests__/userPage.test.tsx`

**Interfaces:**
- Consumes: `tapNext`/`tapPrev` (Task 5), `mediaGradient` (Task 3), `SeenStore.markSeen`.
- Produces:
  ```ts
  function useStoryTimer(o: { durationMs: number; active: boolean; held: boolean; onComplete(): void }): { progress: SharedValue<number>; reset(): void };
  // held = paused || buffering || !mediaReady || appBackground || longPress || dragging
  interface UserPageProps { user: StoryUser; storyIndex: number; isActive: boolean; held: SharedValue<boolean>; onNav(r: NavResult): void; onMediaFirstFrame(story: StoryItem): void }
  ```

- [ ] **Step 1: Failing tests** (fake timers):
  - On an image story with media ready, the progress reaches 1 at 5000 ms and `onNav` gets `tapNext`'s result.
  - With `durationMs: 2000` it completes at 2000 ms.
  - Before `onDisplay` fires (mock expo-image), progress stays at 0 after 3000 ms.
  - A tap at x = 0.29 × width calls `onNav` with `tapPrev`'s result; x = 0.31 × width gives `tapNext`.
  - A long-press of 200 ms freezes progress, and UI opacity goes to 0 within 150 ms. Release resumes progress, and UI opacity is 1 after 200 ms.
  - A story is marked seen on `onDisplay` of the active page only; a non-active (preview) page never marks it.
  - Media `onError` keeps the background visible, and after 4000 ms `onNav` advances. The story is not marked seen.
  - The progress bar has `accessibilityRole "progressbar"` and label `"Story 2 of 3"`.
  - `MediaBackground` stops equal `mediaGradient(story, theme.viewer.bgFallback)`.
- [ ] **Step 2:** Run `yarn test userPage`. Expected: FAIL.
- [ ] **Step 3:** Implement. Gestures: `useExclusiveGestures(longPress(200ms, maxDist 10), tap(maxDuration 250, maxDist 10))`. Timer: `withTiming(1, {duration: remaining, easing: Easing.linear})`, `cancelAnimation` on hold, `scheduleOnRN(onComplete)`. Image uses `expo-image` with `placeholder={{thumbhash}}` (or the `thumbnail` uri) and `transition={220}`. Show the loading indicator only after 250 ms.
- [ ] **Step 4:** Run `yarn test userPage`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(viewer): user page with timer, tap zones and image media`.

### Task 10: Video media, buffering and preloading

**Files:**
- Create: `src/viewer/media/VideoMedia.tsx`, `src/viewer/media/preload.ts`
- Modify: `src/viewer/UserPage.tsx`
- Test: `src/__tests__/video.test.tsx`

**Interfaces:**
- Consumes: `useStoryTimer`, `UserPageProps`.
- Produces:
  ```ts
  function VideoMedia(p: { story: StoryItem; playing: boolean; onFirstFrame(): void; onBuffering(b: boolean): void; onDuration(ms: number): void; onError(): void }): JSX.Element;
  function usePreload(users: StoryUser[], nav: NavState): void; // prefetch next story + next user's entry story
  ```

- [ ] **Step 1: Failing tests** (mocked `expo-video` that emits `statusChange`, `sourceLoad` and `onFirstFrameRender`):
  - The timer duration equals the video duration from `sourceLoad` (e.g. 7300 ms).
  - `statusChange 'loading'` mid-play freezes progress; returning to `'readyToPlay'` resumes it.
  - The thumbhash placeholder stays until `onFirstFrameRender`, then it is removed after a 180 ms fade.
  - `playing=false` (long-press) pauses the player.
  - No more than 2 `useVideoPlayer` instances exist while 3 user pages are mounted: neighbour pages show placeholders.
  - `usePreload` calls `Image.prefetch` with the next image uri, and creates a source-loaded player for the next video.
- [ ] **Step 2:** Run `yarn test video`. Expected: FAIL.
- [ ] **Step 3:** Implement with `useVideoPlayer` + `VideoView`. A video error follows the Task 9 error path.
- [ ] **Step 4:** Run `yarn test video`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(viewer): video stories with buffering and preloading`.

### Task 11: Cube swipe, rubber band, drag-down dismiss, swipe-up, reduce motion

**Files:**
- Modify: `src/viewer/StoryViewer.tsx` (3 mounted pages, pan gestures, transitions)
- Test: `src/__tests__/gestures.test.tsx`

**Interfaces:**
- Consumes: `swipeDecision`, `rubberBand`, `cubeTransform`, `dismissProgress`, `dismissStyle`, `shouldDismiss`, `shouldSwipeUp` (Task 6); `swipeToUser`, `tapNext` (Task 5); `useViewerControls` (Task 8).
- Produces: a viewer `isTransitioning: SharedValue<boolean>`, which ignores tap and pan input while true.

- [ ] **Step 1: Failing tests** (GH `fireGestureHandler` / `getByGestureTestId`, fake timers):
  - A pan with dx = −140 on U0 ends on U1 after the settle spring. Active user is U1 at its first unseen story.
  - A pan with dx = −100, vx = 0 springs back to U0, and U0's progress resumes from where it paused.
  - A pan with dx = +140 on U0 (the first user) does not change user and does not close. The offset during the drag equals `rubberBand(140, width)`.
  - A pan with dx = −140 on the last user does not close.
  - A pan with dy = 130 closes (`onClose` once). A pan with dy = 60, vy = 0 springs back and resumes.
  - A pan with dy = −90 calls `onSwipeUp(story, user)` and does not close.
  - Two taps 50 ms apart on the last story of U0 land on U1 story 0, not U2.
  - With `useReducedMotion()` mocked to true, the user change uses opacity with no `rotateY` in the style, and dismiss has scale 1.
  - Only pages `active−1`, `active` and `active+1` are rendered.
- [ ] **Step 2:** Run `yarn test gestures`. Expected: FAIL.
- [ ] **Step 3:** Implement. Compose `useCompetingGestures(panX(activeOffsetX ±12, failOffsetY ±12), panY(activeOffsetY [10,∞) plus the upward branch), pageGestures)`. Cube settle uses spring damping 22, stiffness 220, mass 1, overshootClamping. A programmatic user change uses 320 ms `Easing.bezier(0.22,1,0.36,1)`. Pause the story during any drag.
- [ ] **Step 4:** Run `yarn test gestures`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(viewer): cube swipe, dismiss and swipe-up gestures`.

### Task 12: Lifecycle and accessibility hardening

**Files:**
- Modify: `src/viewer/StoryViewer.tsx`, `src/viewer/UserPage.tsx`, `src/provider/StoryProvider.tsx`
- Test: `src/__tests__/lifecycle.test.tsx`

**Interfaces:**
- Consumes: everything above; `reconcileNavState` (Task 5).

- [ ] **Step 1: Failing tests.**
  - `AppState` going to `'background'` holds progress, and `'active'` resumes it.
  - When the screen reader is enabled (mock `AccessibilityInfo.isScreenReaderEnabled`), progress does not auto-advance. With `config.autoAdvanceWithScreenReader: true` it does.
  - The accessibility actions `"Next story"`/`"Previous story"` on the page navigate. Magic tap toggles pause.
  - A user change announces `"Ada, story 1 of 3, 2h ago"` via `AccessibilityInfo.announceForAccessibility`.
  - `users` prop update while open: removing the active user's story keeps the user and clamps the index. Removing the active user closes the viewer. Appending users keeps the current story.
  - The ref/hook API: `pause()`, `resume()`, `next()`, `prev()` and `goToUser('U2')` act on the open viewer and are no-ops when it is closed.
- [ ] **Step 2:** Run `yarn test lifecycle`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `yarn test && yarn typecheck && yarn lint`. Expected: all PASS.
- [ ] **Step 5:** Commit `feat(viewer): lifecycle, screen reader and live data handling`.

### Task 13: Example app, perf screen, README

**Files:**
- Create: `example/src/App.tsx`, `example/src/data.ts`, `example/src/screens/{Feed,Themes,CustomHeader,Perf}.tsx`, `example/scripts/thumbhash.mjs`, `README.md`
- Modify: `src/index.ts` (final public exports)

**Interfaces:**
- Consumes: the public API. `src/index.ts` exports `StoryProvider`, `StoryList`, `StoryRing`, `useStoryViewer`, `StoryThemeProvider`, `useStoryTheme`, `lightTheme`, `darkTheme`, `palettes`, `defaultConfig`, `createMemorySeenStorage`, `createMMKVSeenStorage`, `createAsyncStorageSeenStorage`, and all types.

- [ ] **Step 1:** `example/scripts/thumbhash.mjs` (devDep `sharp`) downloads the sample images and prints thumbhash base64. Hard-code the output into `data.ts`: about 12 users, a mix of images and videos (public sample MP4s), one `closeFriends` user, one user with only seen stories.
- [ ] **Step 2:** Screens:
  - **Feed:** list + viewer with MMKV storage.
  - **Themes:** switch between all palettes and light/dark.
  - **CustomHeader:** `renderHeader`/`renderFooter`, `onSwipeUp`.
  - **Perf:** 200 users, plus a JS-thread blocker button (a busy loop) to show animations stay smooth.
- [ ] **Step 3:** Run `yarn example ios`. Walk through every behaviour in design §5–§8 on the simulator and record screenshots: tap, long-press, swipe cube, rubber band, drag-down, X, seen ring change, placeholder crossfade, media background.
- [ ] **Step 4:** Write the README: install (peers, babel plugin, `GestureHandlerRootView`, dev build), quick start, data model, props table, theming, seen storage adapters, accessibility. Run `yarn test && yarn typecheck && yarn lint && yarn prepare`. Expected: all pass, and `lib/` is built.
- [ ] **Step 5:** Commit `docs: example app and README`.
