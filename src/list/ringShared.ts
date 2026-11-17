import { useEffect } from 'react';
import {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useStoryContext } from '../provider/StoryProvider';
import { palettes } from '../theme/palettes';
import { useStoryTheme } from '../theme/StoryThemeProvider';
import type { PaletteName } from '../types';

/** Gradient colours for a ring: the user's palette or colours, else the theme's. */
export function useRingStops(palette?: PaletteName | string[]): string[] {
  const theme = useStoryTheme();
  const { scheme } = useStoryContext();
  const chosen = palette ?? theme.ring.palette;
  return Array.isArray(chosen) ? chosen : palettes[chosen][scheme];
}

/** Animated props that fade the gradient stroke out when `hidden` (seen). */
export function useSeenFade(hidden: boolean) {
  const { config } = useStoryContext();
  const opacity = useSharedValue(hidden ? 0 : 1);
  useEffect(() => {
    opacity.value = withTiming(hidden ? 0 : 1, {
      duration: config.motion.seenRingMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [hidden, opacity, config.motion.seenRingMs]);
  return useAnimatedProps(() => ({ opacity: opacity.value }));
}
