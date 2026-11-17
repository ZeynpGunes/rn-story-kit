import { View } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

function FadeIn() {
  const opacity = useSharedValue(0);
  opacity.value = withTiming(1, { duration: 200 });
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View testID="fade" style={style} />;
}

describe('test harness', () => {
  it('renders inside GestureHandlerRootView', async () => {
    await render(
      <GestureHandlerRootView>
        <View testID="x" />
      </GestureHandlerRootView>
    );
    expect(screen.getByTestId('x')).toBeTruthy();
  });

  it('resolves withTiming under fake timers', async () => {
    jest.useFakeTimers();
    await render(<FadeIn />);
    jest.advanceTimersByTime(300);
    expect(screen.getByTestId('fade')).toHaveAnimatedStyle({ opacity: 1 });
    jest.useRealTimers();
  });
});
