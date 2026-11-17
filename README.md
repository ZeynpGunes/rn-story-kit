# rn-story-kit

Instagram-style stories for React Native.

## Requirements

- React Native New Architecture only. A development build is required (Expo Go is not supported, because of the native modules).
- Requires the New Architecture and React Native Reanimated 4 (`react-native-worklets`). Your minimum React Native version is whatever your installed Reanimated 4 release supports; the example app runs React Native 0.88.1 with Reanimated 4.7.1.

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
interface StoryPerson {
  id: string;
  name: string;
  avatar: string;
  following?: boolean; // false/omitted → Follow button in the people list
}

interface StoryUser {
  id: string;
  name: string;
  avatar: string;
  stories: StoryItem[];
  ringVariant?: 'classic' | 'ocean' | 'sunset' | 'mono' | 'closeFriends';
  ringColors?: string[]; // custom ring gradient stops
  isOwner?: boolean; // your row: shows view/like counts instead of the action bar
  suggested?: boolean; // someone you do not follow: shows follow and dismiss buttons
  cover?: string; // card variant image; falls back to avatar
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
  viewCount?: number; // owner insights
  likeCount?: number;
  viewers?: StoryPerson[]; // modal list when view count is tapped
  likers?: StoryPerson[]; // modal list when like count is tapped
  liked?: boolean; // whether *I* liked this story (others' stories)
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
| `onLike` | `(story, user, nextLiked) => void` | Heart toggled on someone else's story. |
| `onSendMessage` | `(story, user, text) => void` | Reply field submitted. |
| `onVoice` | `(story, user) => void` | Mic pressed. |
| `onShare` | `(story, user) => void` | Share / send pressed. |
| `onFollow` | `(person) => void` | Follow pressed in the viewers / likers list, or on a suggested bubble (`following: false`). |
| `onDismissSuggestion` | `(user) => void` | X pressed on a suggested bubble. The list hides the user at once; you persist the choice. |
| `onAddStory` | `() => void` | Empty owner bubble (+) pressed — navigate to create. |
| `renderHeader` | `(p: StorySlotProps) => ReactNode` | Replace the header. See below. |
| `renderFooter` | `(p: StorySlotProps) => ReactNode` | Replaces the default footer entirely. |
| `renderOverlay` | `(p: StorySlotProps) => ReactNode` | Full-screen overlay slot. |

`StorySlotProps` is `{ user, story, storyIndex, close(), pause(), resume() }`.

### Default footer

When you do not pass `renderFooter`, the viewer shows a built-in footer:

- **Own story** (`user.isOwner`): view count and like count. Tap either to open a modal of `viewers` / `likers`. People with `following !== true` show a Follow button; handle it with `onFollow` and refresh `users`.
- **Others**: message field, like, voice, and share. Toggle each with `config.actions` (all default `true`). Wire behaviour with `onLike`, `onSendMessage`, `onVoice`, and `onShare` — the library only draws the controls and pauses playback while the field is focused or the modal is open.

### Strings (i18n)

All user-facing copy lives in `config.strings` (defaults in `defaultStrings`). Pass only the keys you want to override; templates use `{name}`, `{n}`, `{index}`, `{count}`, `{number}`, `{time}`, `{status}`-style tokens:

```tsx
<StoryProvider
  users={users}
  config={{
    strings: {
      follow: 'Takip Et',
      viewersTitle: 'Görüntüleyenler',
      likesTitle: 'Beğeniler',
      replyPlaceholder: 'Mesaj gönder...',
      viewOther: '{n} görüntülenme',
    },
  }}
>
```

### Other exports

- `StoryList` (`style`, `contentContainerStyle`, `ListHeaderComponent`, `variant`): the horizontal bubble list.
- `StoryCardRing` (`seen`, `palette`, `cover`, `ringId`): the card-shaped ring on its own.
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

## Config

Pass `config` to `StoryProvider` to change behaviour. Defaults are in `defaultConfig`.

| Option | Default | Description |
| --- | --- | --- |
| `imageDurationMs` | `5000` | How long an image story shows before advancing. |
| `tapZoneRatio` | `0.3` | Left share of the screen width where a tap goes to the previous story. |
| `sortUnseenFirst` | `true` | Sort users with unseen stories before fully seen users. `false` keeps your order. |
| `mediaErrorAdvanceMs` | `4000` | Wait after a media error before advancing to the next story. |
| `autoAdvanceWithScreenReader` | `false` | Keep auto-advancing while a screen reader is on. |
| `formatTime` | relative time | `(createdAt: number) => string`, replaces the header time label. |
| `actions` | all `true` | `{ message, like, voice, share }` — which controls show on others' stories. |
| `list` | `{ variant: 'circle' }` | Default bubble shape: `'circle'` or `'card'`. The `StoryList` `variant` prop wins. |
| `ownerBubble` | see below | Own-story row in the list (`show`, `pinFirst`, `showAddWhenEmpty`). |
| `strings` | `defaultStrings` | UI + accessibility copy. See [Strings (i18n)](#strings-i18n). |
| `motion` | see `defaultConfig` | Durations, springs and gesture thresholds. |

### Own story bubble

Mark the signed-in user with `isOwner: true`.

- Label uses `strings.yourStory` (default `'Your story'`), not `user.name`.
- With stories: tap opens the viewer as usual; bubble stays first when `ownerBubble.pinFirst` is true.
- With **no** stories and `ownerBubble.showAddWhenEmpty`: shows a **+** badge; tap calls `onAddStory` (you route to your create screen).
- Hide entirely: `config.ownerBubble.show: false` (or omit `isOwner`).

```tsx
<StoryProvider
  users={users}
  onAddStory={() => navigation.navigate('CreateStory')}
  config={{
    ownerBubble: { show: true, pinFirst: true, showAddWhenEmpty: true },
    strings: { yourStory: 'Hikayen', addStory: 'Hikaye ekle' },
  }}
>
```

### Suggested stories

Mark people the viewer does not follow with `suggested: true`. Their bubble gets two buttons:

- **Follow**: calls `onFollow({ id, name, avatar, following: false })` and hides the button for that user. Send `suggested: false` in your next `users` update.
- **X**: calls `onDismissSuggestion(user)` and removes the bubble at once (in memory, for the provider's lifetime). You persist the choice and stop sending the user.

Neither button opens the viewer, and each has a hit area of at least 44x44. The owner bubble never shows them. The bubble label uses `strings.bubbleSuggested`; the buttons use `strings.followSuggested` and `strings.dismissSuggestion`.

```tsx
<StoryProvider
  users={users}
  onFollow={(person) => api.follow(person.id)}
  onDismissSuggestion={(user) => api.dismissSuggestion(user.id)}
>
```

### Card variant

`<StoryList variant="card" />` (or `config.list.variant: 'card'` for the whole app) draws tall rounded cards instead of circles. The card shows `user.cover` (or `avatar`), a gradient border when unseen and a thin grey one when seen. An empty owner card shows the **+** near its bottom edge; suggested cards put the X top-right and Follow bottom-right. The viewer opens and closes from the card's real corner radius. Sizes and colours live in `theme.list.card` and `theme.list.suggested`.

```tsx
<StoryList variant="card" />
```

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
- Stories do not auto-advance while a screen reader is on (unless `config.autoAdvanceWithScreenReader` is `true`), so users move with the "Next story" and "Previous story" actions.
- With "Reduce Motion" on, the cube turn, drag-to-dismiss and open/close animations become short fades.

## Example app

```sh
yarn
yarn example ios
```

The example in `example/` has four screens: Feed (MMKV seen storage, owner insights, and the action bar), Themes, CustomHeader (slots and `onSwipeUp`) and Perf (200 users and a button that blocks the JS thread). It needs a development build, not Expo Go. Run `node scripts/thumbhash.mjs` in `example/` to regenerate the sample thumbhashes.

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
