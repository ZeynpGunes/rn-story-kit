# rn-story-kit — Visual & Motion Spec

Source: designer pass, 2026-11-17. Companion to `2026-11-17-rn-story-kit-design.md`. Every number here is the default; all are overridable via theme/config.

Direction: dark-cinematic, quiet chrome. Media is the hero; UI is thin white-on-scrim. Original look: thin ring (2.5) with generous 3 gap, own palette names, no Instagram exact stops.

## 1. Theme tokens

```ts
type StoryTheme = {
  ring: {
    width: 2.5; gap: 3; sizes: { sm: 44; md: 64; lg: 76 }; // outer = size + 2*(width+gap)
    seen: { light: '#C9CCD1'; dark: '#4A4D55' }; seenWidth: 1.5; palette: 'classic';
  };
  progress: {
    height: 2.5; gap: 3; radius: 1.25; topInset: 8 /* + safeAreaTop */; sideInset: 8;
    track: { light: 'rgba(255,255,255,0.38)'; dark: 'rgba(255,255,255,0.30)' }; fill: '#FFFFFF';
  };
  header: {
    avatar: 32; gapAvatarName: 10; marginTop: 10 /* below progress */; sideInset: 12;
    name: { size: 14; weight: '600'; lineHeight: 18; color: '#FFF' };
    time: { size: 13; weight: '400'; lineHeight: 18; color: 'rgba(255,255,255,0.72)'; marginLeft: 8 };
    closeBtn: { icon: 24; hit: { w: 44; h: 44 }; stroke: 2; color: '#FFF'; right: 4 };
    shadow: { color: 'rgba(0,0,0,0.35)'; radius: 3; offsetY: 1 };
  };
  viewer: { bgFallback: { light: '#111214'; dark: '#000000' }; dismissBg: '#000' };
  loading: { size: 28; stroke: 2; color: 'rgba(255,255,255,0.85)'; trackColor: 'rgba(255,255,255,0.2)'; rotationMs: 900; showAfterMs: 250 };
  list: {
    bubble: 64 /* ring outer 76 */; itemWidth: 84; gap: 4; paddingH: 12;
    name: {
      size: 12; weight: '400'; lineHeight: 16;
      color: { light: '#1C1C1E'; dark: '#F2F2F7' }; seenColor: { light: '#6B6F76'; dark: '#9A9DA5' };
      marginTop: 6; maxWidth: 76; lines: 1; ellipsizeMode: 'tail'; align: 'center';
    };
  };
  avatarPlaceholder: { light: '#E4E6EA'; dark: '#2A2C31' };
};
```

## 2. Ring palettes (stops evenly spaced 0..1; first = last hides the seam)

- `classic` (default): `#FFC247, #FF8A3D, #F2475F, #C73CA8, #FFC247`
- `ocean`: `#2DE2E6, #2F8CFF, #5B5BFF, #2F8CFF, #2DE2E6`
- `sunset`: `#FFD36B, #FF7A59, #E8456B, #7A3FD1, #FFD36B`
- `mono`: light `#2B2D31, #8A8D94, #2B2D31`; dark `#FFFFFF, #8E9097, #FFFFFF`
- `closeFriends`: `#3DDC84, #12B76A, #7AE582, #12B76A, #3DDC84`
- Seen: light `#C9CCD1`, dark `#4A4D55`.

## 3. Ring render (react-native-svg only, no sweep gradient)

- One `Circle`, `r = outer/2 - width/2`, `fill="none"`, `strokeWidth=width`, stroked with `url(#grad)`.
- `LinearGradient` `x1=0 y1=0 x2=1 y2=1` (objectBoundingBox), stops above. Svg wrapped in a view rotated 45deg so colour flows bottom-left to top-right.
- Seen transition: two stacked circles (gradient, seen). Animate gradient circle opacity 1 to 0 over 400ms, `Easing.out(Easing.cubic)`, on UI thread via `useAnimatedProps`.
- Unique gradient id per ring (derived from userId) to avoid svg id collisions.
- Seen ring is thinner (1.5 vs 2.5), so state is not conveyed by colour alone.

## 4. Motion constants

- **Tap advance:** instant swap (0ms) story to story in same user. 90ms media crossfade only if next is already decoded. Previous segment fills instantly.
- **Progress fill:** `Easing.linear`, duration = story duration (photo 5000ms; video = its duration). Shared value 0..1; pause freezes it.
- **Long-press pause:** 200ms delay; cancel if finger moves > 10px.
- **UI hide/show:** hide 150ms fade, show 200ms fade, `Easing.out(Easing.cubic)`. Hidden UI `pointerEvents="none"`.
- **Cube:** perspective 1000 (first transform). `p = dx/width`; incoming `rotateY = p*90deg`, mirrored on outgoing; pivot at shared edge (translateX ±width/2 before/after rotate). Shade overlay `rgba(0,0,0, 0.5*(1-|p|))` on incoming page. Settle spring: damping 22, stiffness 220, mass 1, overshootClamping true. Programmatic user change (tap past last story): `withTiming` 320ms, `Easing.bezier(0.22,1,0.36,1)`.
- **Swipe commit:** `|dx| > 0.33*width` OR `|vx| > 600 px/s` (direction matches dx sign). Pan-x activates at `activeOffsetX ±12`, `failOffsetY ±12`.
- **Rubber-band at edges:** `offset = dx*0.35 / (1 + |dx|/width)`. Release spring damping 20, stiffness 260, mass 1.
- **Drag-down dismiss:** `activeOffsetY [10, ∞)`. `p = clamp(dy/(height*0.6), 0, 1)`. scale `1 - 0.25*p` (min 0.75); borderRadius `40*p`; translate follows finger 1:1; bg opacity `1 - p`; UI opacity `1 - min(p*3, 1)`. Commit: `dy > 120` OR `vy > 800 px/s`. Snap back spring damping 18, stiffness 240, mass 0.9. Story paused during drag, resumes on snap back.
- **Swipe up:** no visual follow beyond 16px (dampened). Fire `onSwipeUp` when `dy < -80` or `vy < -700`.
- **Open from bubble:** 380ms, `Easing.bezier(0.2,0.9,0.2,1)`. Interpolate rect bubble to screen; borderRadius bubbleSize/2 to 0; content opacity 0 to 1 over first 40%. Source bubble opacity 0 while viewer open.
- **Close to bubble:** 300ms, `Easing.bezier(0.4,0,0.2,1)`; borderRadius 0 to bubbleSize/2; content fades out over first 60%. No rect: 200ms fade + scale 1 to 0.92.
- **Thumb to media crossfade:** 220ms linear (image). Video: thumb stays until first frame, then 180ms.
- **Seen ring transition:** 400ms, `Easing.out(Easing.cubic)`.
- **Media background gradient:** 3 vertical stops from thumbhash average colour `c`, after saturation boost ×1.1 and clamping HSL lightness ≤ 0.45: top `c`, mid `mix(c,'#000',0.25)`, bottom `mix(c,'#000',0.55)`. Explicit `colors` (1–3) replaces stops. Fallback `viewer.bgFallback`.

## 5. Tap zones

- Left 30% = previous, right 70% = next (`tapZoneRatio: 0.3`).
- Full-bleed Tap gesture (maxDuration 250ms, maxDistance 10) beneath the UI layer.
- Header container `pointerEvents="box-none"`; only the avatar/name row (optional `onPress`) and close button capture touches. Blank header space still navigates.
- Close X: 44x44 pressable, touch consumed. Positioned right 4, top = progress bottom + 2.
- Progress bar area: `pointerEvents="none"`.
- Gesture composition: `Race(panDismiss/panX, Exclusive(longPress 200ms, tap))`.

## 6. Accessibility

- **Top scrim:** height safeAreaTop + 96; stops 0: `rgba(0,0,0,0.55)`, 0.6: `rgba(0,0,0,0.18)`, 1: transparent. Plus header text shadow. Optional bottom scrim 120px, 0 to 0.45 black.
- **Reduce motion** (`useReducedMotion`): cube becomes 200ms opacity crossfade; drag still commits by same thresholds but page translates linearly without rotation/perspective; dismiss uses bg fade only (no scale/radius), 200ms; bubble open/close 200ms fade; UI fade 100ms; springs replaced by 180ms timing.
- **Screen reader:**
  - viewer `accessibilityViewIsModal`.
  - progress `accessibilityRole="progressbar"`, label "Story {i} of {n}".
  - close: label "Close stories", role button.
  - tap zones expose accessibility actions "Next story"/"Previous story"; magic tap toggles pause.
  - announce on user change "{name}, story 1 of {n}, {time} ago".
  - bubble: role button, label "{name}, {new story | seen}, {n} stories".
  - media `alt` from item.
- When a screen reader is on, auto-advance is paused by default. Flag: `autoAdvanceWithScreenReader` (default false).
