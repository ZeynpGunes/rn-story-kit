import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useStoryTheme } from '../theme/StoryThemeProvider';
import type { PaletteName } from '../types';
import { useRingStops, useSeenFade } from './ringShared';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface StoryRingProps {
  size: 'sm' | 'md' | 'lg' | number;
  seen: boolean;
  palette?: PaletteName | string[];
  avatar: string;
  ringId: string;
  /** When false, avatar only — no gradient or grey border. Default true. */
  showRing?: boolean;
}

export function StoryRing({
  size,
  seen,
  palette,
  avatar,
  ringId,
  showRing = true,
}: StoryRingProps) {
  const theme = useStoryTheme();
  const { width, gap, seenWidth } = theme.ring;
  const avatarSize = typeof size === 'number' ? size : theme.ring.sizes[size];
  const outer = avatarSize + 2 * (width + gap);

  const stops = useRingStops(palette);
  const gradientId = `ring-${ringId}`;
  const gradientProps = useSeenFade(seen || !showRing);

  return (
    <View style={{ width: outer, height: outer }}>
      {showRing && (
        <View style={[StyleSheet.absoluteFill, styles.rotated]}>
          <Svg width={outer} height={outer}>
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                {stops.map((color, i) => (
                  <Stop
                    key={i}
                    offset={stops.length > 1 ? i / (stops.length - 1) : 0}
                    stopColor={color}
                  />
                ))}
              </LinearGradient>
            </Defs>
            <Circle
              testID={`ring-seen-${ringId}`}
              cx={outer / 2}
              cy={outer / 2}
              r={outer / 2 - seenWidth / 2}
              fill="none"
              stroke={theme.ring.seen}
              strokeWidth={seenWidth}
            />
            <AnimatedCircle
              testID={`ring-active-${ringId}`}
              cx={outer / 2}
              cy={outer / 2}
              r={outer / 2 - width / 2}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth={width}
              animatedProps={gradientProps}
            />
          </Svg>
        </View>
      )}
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Image
          source={avatar}
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            backgroundColor: theme.avatarPlaceholder,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rotated: { transform: [{ rotate: '45deg' }] },
  center: { alignItems: 'center', justifyContent: 'center' },
});
