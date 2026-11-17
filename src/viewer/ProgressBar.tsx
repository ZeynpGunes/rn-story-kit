import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useStoryTheme } from '../theme/StoryThemeProvider';
import { progressLabel } from './a11y';

export interface ProgressBarProps {
  count: number;
  /** Zero-based index of the current story. */
  index: number;
  progress: SharedValue<number>;
  safeAreaTop: number;
}

function Fill({
  progress,
  testID,
}: {
  progress: SharedValue<number>;
  testID: string;
}) {
  const { progress: tokens } = useStoryTheme();
  const style = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return (
    <Animated.View
      testID={testID}
      style={[
        styles.fill,
        { backgroundColor: tokens.fill, borderRadius: tokens.radius },
        style,
      ]}
    />
  );
}

/** One segment per story: past full, current animated, upcoming empty. */
export function ProgressBar({
  count,
  index,
  progress,
  safeAreaTop,
}: ProgressBarProps) {
  const { progress: tokens } = useStoryTheme();
  return (
    <View
      pointerEvents="none"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={progressLabel(index + 1, count)}
      style={[
        styles.row,
        {
          top: safeAreaTop + tokens.topInset,
          left: tokens.sideInset,
          right: tokens.sideInset,
          height: tokens.height,
          gap: tokens.gap,
        },
      ]}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            { backgroundColor: tokens.track, borderRadius: tokens.radius },
          ]}
        >
          {i < index && (
            <View
              style={[
                styles.fill,
                styles.full,
                {
                  backgroundColor: tokens.fill,
                  borderRadius: tokens.radius,
                },
              ]}
            />
          )}
          {i === index && (
            <Fill progress={progress} testID="story-progress-fill" />
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'absolute', flexDirection: 'row' },
  segment: { flex: 1, overflow: 'hidden' },
  fill: { height: '100%' },
  full: { width: '100%' },
});
