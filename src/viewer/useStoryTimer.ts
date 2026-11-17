import { useCallback, useEffect, useRef } from 'react';
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export interface StoryTimerOptions {
  durationMs: number;
  active: boolean;
  /** paused || buffering || !mediaReady || appBackground || longPress || dragging */
  held: boolean;
  onComplete(): void;
}

/** Linear 0..1 progress; freezes while held and resumes from where it was. */
export function useStoryTimer({
  durationMs,
  active,
  held,
  onComplete,
}: StoryTimerOptions): { progress: SharedValue<number>; reset(): void } {
  const progress = useSharedValue(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const complete = useCallback(() => onCompleteRef.current(), []);

  useEffect(() => {
    if (!active || held || progress.value >= 1) return;
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
    return () => cancelAnimation(progress);
  }, [active, held, durationMs, progress, complete]);

  const reset = useCallback(() => {
    cancelAnimation(progress);
    progress.value = 0;
  }, [progress]);

  return { progress, reset };
}
