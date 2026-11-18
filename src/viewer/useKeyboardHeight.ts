import { useEffect } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';
import {
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const SHOW = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HIDE = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

/** Keyboard height in px, animated with the keyboard; 0 while `enabled` is false. */
export function useKeyboardHeight(enabled: boolean): SharedValue<number> {
  const height = useSharedValue(0);
  useEffect(() => {
    if (!enabled) return;
    const to = (h: number) => (e?: KeyboardEvent) => {
      height.value = withTiming(
        h === -1 ? (e?.endCoordinates.height ?? 0) : h,
        {
          duration: e?.duration ?? 250,
        }
      );
    };
    const subs = [
      Keyboard.addListener(SHOW, to(-1)),
      Keyboard.addListener(HIDE, to(0)),
    ];
    return () => {
      subs.forEach((s) => s.remove());
      height.value = 0;
    };
  }, [enabled, height]);
  return height;
}
