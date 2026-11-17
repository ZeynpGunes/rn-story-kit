import { useCallback, useEffect, useRef } from 'react';
import {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export interface StoryTimerOptions {
  durationMs: number;
  active: boolean;
  /** paused || buffering || !mediaReady || appBackground || longPress || dragging */
  held: SharedValue<boolean>;
  onComplete(): void;
}

/**
 * Linear 0..1 progress driven on the UI thread. Freezes while held and
 * resumes from where it stopped.
 */
export function useStoryTimer({
  durationMs,
  active,
  held,
  onComplete,
}: StoryTimerOptions): { progress: SharedValue<number>; reset(): void } {
  const progress = useSharedValue(0);
  const activeSv = useSharedValue(active);
  useEffect(() => {
    activeSv.value = active;
  }, [activeSv, active]);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const complete = useCallback(() => onCompleteRef.current(), []);

  useAnimatedReaction(
    () => activeSv.value && !held.value,
    (running) => {
      if (!running) {
        cancelAnimation(progress);
        return;
      }
      if (progress.value >= 1) return;
      progress.value = withTiming(
        1,
        {
          duration: durationMs * (1 - progress.value),
          easing: Easing.linear,
        },
        (finished) => {
          'worklet';
          if (finished) scheduleOnRN(complete);
        }
      );
    }
  );

  const reset = useCallback(() => {
    cancelAnimation(progress);
    progress.value = 0;
  }, [progress]);

  return { progress, reset };
}
