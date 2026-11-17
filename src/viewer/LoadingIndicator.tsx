import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useStoryTheme } from '../theme/StoryThemeProvider';

/** Centered spinner; the caller decides when it appears. */
export function LoadingIndicator() {
  const { loading } = useStoryTheme();
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: loading.rotationMs, easing: Easing.linear }),
      -1
    );
    return () => cancelAnimation(rotation);
  }, [rotation, loading.rotationMs]);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const { size, stroke } = loading;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <Animated.View
      testID="story-loading"
      pointerEvents="none"
      style={[
        styles.center,
        {
          width: size,
          height: size,
          marginTop: -size / 2,
          marginLeft: -size / 2,
        },
        style,
      ]}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={loading.trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={loading.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * 0.25} ${c}`}
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: '50%',
    left: '50%',
  },
});
