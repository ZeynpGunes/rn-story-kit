# rn-story-kit

Instagram-style stories for React Native

## Requirements

- React Native New Architecture only. A development build is required (Expo Go is not supported, because of the native modules).
- Minimum React Native is whatever the Reanimated 4 release you install supports: RN 0.78 with Reanimated 4.1, RN 0.86 to 0.88 with Reanimated 4.7. The example app runs RN 0.88 with Reanimated 4.7.1.

## Installation

```sh
npm install rn-story-kit
npm install react-native-reanimated react-native-worklets react-native-gesture-handler \
  react-native-svg react-native-safe-area-context expo-image expo-video
```

Peer dependencies: `react-native-reanimated >=4.1.0`, `react-native-worklets >=0.5.0`, `react-native-gesture-handler >=3.0.0`, `react-native-svg >=15.0.0`, `react-native-safe-area-context >=5.0.0`, `expo-image`, `expo-video`. MMKV and AsyncStorage are not peers (see [Seen storage](#seen-storage)).

Add the worklets Babel plugin, last in the plugin list (`babel-preset-expo` adds it for you in Expo projects):

```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['react-native-worklets/plugin'],
};
```

Then rebuild the native app (`npx expo prebuild` and `npx expo run:ios`, or your usual native build).

### App root

The library needs `GestureHandlerRootView` and `SafeAreaProvider` above `StoryProvider`:

```tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function Root() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <App />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

## Quick start

```tsx
import { StoryList, StoryProvider, type StoryUser } from 'rn-story-kit';

const users: StoryUser[] = [
  {
    id: 'ada',
    name: 'ada',
    avatar: 'https://example.com/ada.jpg',
    stories: [
      { id: 'ada-1', type: 'image', uri: 'https://example.com/1.jpg' },
      { id: 'ada-2', type: 'video', uri: 'https://example.com/2.mp4' },
    ],
  },
];

export function Stories() {
  return (
    <StoryProvider users={users}>
      <StoryList />
    </StoryProvider>
  );
}
```

The viewer is an overlay rendered inside `StoryProvider` (no React Native `Modal`). Open it by tapping a bubble in `StoryList`, or from code with `useStoryViewer().open(userId)`.

## Data model

```ts
interface StoryUser {
  id: string;
  name: string;
  avatar: string;
  stories: StoryItem[];
  ringVariant?: 'classic' | 'ocean' | 'sunset' | 'mono' | 'closeFriends';
  ringColors?: string[]; // custom ring gradient stops
}

interface StoryItem {
  id: string;
  type: 'image' | 'video';
  uri: string;
  durationMs?: number; // images: default 5000; videos: the video length
  thumbhash?: string; // base64; shown as placeholder and used for the background
  thumbnail?: string; // placeholder image uri
  colors?: string[]; // background gradient colors, if you know them
  alt?: string; // accessibility label
  seen?: boolean; // initial seen state
  createdAt?: number; // ms since epoch, shown as relative time in the header
  data?: unknown; // your own payload, passed back to slots
}
```

Users with no stories are hidden. Unseen users are sorted first.

## API

### `StoryProvider` props

| Prop | Type | Description |
| --- | --- | --- |
| `users` | `StoryUser[]` | Required. Keep the array stable between renders. |
| `theme` | `DeepPartial<StoryTheme>` | Token overrides, merged over the light or dark theme. |
| `scheme` | `'light' \| 'dark' \| 'system'` | Default `'system'`. |
| `config` | `DeepPartial<StoryConfig>` | Behaviour and motion overrides. See `defaultConfig`. |
| `seenStorage` | `SeenStorage` | Persists seen ids. See [Seen storage](#seen-storage). |
| `initialSeen` | `string[]` | Story ids to treat as seen at start. |
| `onSeen` | `(storyId, userId) => void` | Fires once per story. |
| `onOpen` | `(userId) => void` | Viewer opened. |
| `onClose` | `() => void` | Viewer closed. |
| `onSwipeUp` | `(story, user) => void` | Swipe-up gesture committed. |
| `onEndReached` | `() => void` | List scrolled to the end; load more users. |
| `renderHeader` | `(p: StorySlotProps) => ReactNode` | Replace the header. See below. |
| `renderFooter` | `(p: StorySlotProps) => ReactNode` | Footer slot above the bottom edge. |
| `renderOverlay` | `(p: StorySlotProps) => ReactNode` | Full-screen overlay slot. |

`StorySlotProps` is `{ user, story, storyIndex, close(), pause(), resume() }`.

### Other exports

- `StoryList` (`style`, `contentContainerStyle`, `ListHeaderComponent`): the horizontal bubble list.
- `StoryRing` (`size`, `seen`, `palette`, `avatar`, `ringId`): the ring on its own, for custom layouts.
- `useStoryViewer()`: `{ open(userId, rect?), close(), next(), prev(), pause(), resume(), goToUser(userId), isOpen }`.
- `StoryThemeProvider`, `useStoryTheme`, `lightTheme`, `darkTheme`, `palettes`, `defaultConfig`.
- Seen storage adapters and all public types.

### Custom slots

`renderHeader` has three outcomes:

- returns `undefined`: the default header is shown;
- returns `null`: no header at all;
- returns an element: that element replaces the header.

Not passing `renderHeader` also keeps the default header.

If your slot has its own interaction (a text input, a menu, a long press), call `pause()` when it starts and `resume()` when it ends, so the story timer and video stop while the user interacts:

```tsx
<StoryProvider
  users={users}
  renderFooter={({ pause, resume }) => (
    <TextInput onFocus={pause} onBlur={resume} placeholder="Reply" />
  )}
>
```

## Theming

```tsx
<StoryProvider
  users={users}
  scheme="dark"
  theme={{ ring: { palette: 'ocean', width: 3 }, progress: { height: 3 } }}
>
```

- Palettes: `classic`, `ocean`, `sunset`, `mono`, `closeFriends`. Pick one with `theme.ring.palette`, per user with `ringVariant`, or pass your own stops with `ringColors`.
- `lightTheme` and `darkTheme` hold every token (ring, progress bar, header, loading indicator, list). Override only what you need.
- Use `StoryThemeProvider` to theme `StoryList` and `StoryRing` outside a provider.
- Motion numbers (durations, springs, thresholds) live in `config.motion`.

## Seen storage

Seen ids are kept in memory and, if you pass `seenStorage`, mirrored to storage. A `SeenStorage` is `{ getAll(), add(ids), clear?() }`, sync or async. Three adapters ship with the library. The MMKV and AsyncStorage adapters take an instance you create, so the library does not depend on either package.

```tsx
import { createMMKV } from 'react-native-mmkv';
import {
  createMemorySeenStorage,
  createMMKVSeenStorage,
  createAsyncStorageSeenStorage,
} from 'rn-story-kit';

createMemorySeenStorage(); // lost on restart
createMMKVSeenStorage(createMMKV()); // sync
createAsyncStorageSeenStorage(AsyncStorage); // async
```

Both persistent adapters take an optional second argument, the storage key. Storage errors never break playback: memory stays the source of truth.

## Accessibility

- Bubbles, the close button and the progress bar have labels. The viewer announces the user and story position when it changes.
- Stories do not auto-advance while a screen reader is on, so users move with the "Next story" and "Previous story" actions.
- With "Reduce Motion" on, the cube turn, drag-to-dismiss and open/close animations become short fades.

## Example app

```sh
yarn
yarn example ios
```

The example in `example/` has four screens: Feed (MMKV seen storage), Themes, CustomHeader (slots and `onSwipeUp`) and Perf (200 users and a button that blocks the JS thread). It needs a development build, not Expo Go. Run `node scripts/thumbhash.mjs` in `example/` to regenerate the sample thumbhashes.

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
