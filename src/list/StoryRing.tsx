import { useEffect } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useStoryContext } from '../provider/StoryProvider';
import { palettes } from '../theme/palettes';
import { useStoryTheme } from '../theme/StoryThemeProvider';
import type { PaletteName } from '../types';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface StoryRingProps {
  size: 'sm' | 'md' | 'lg' | number;
  seen: boolean;
  palette?: PaletteName | string[];
  avatar: string;
  ringId: string;
}

export function StoryRing({
  size,
  seen,
  palette,
  avatar,
  ringId,
}: StoryRingProps) {
  const theme = useStoryTheme();
  const { scheme, config } = useStoryContext();
  const { width, gap, seenWidth } = theme.ring;
  const avatarSize = typeof size === 'number' ? size : theme.ring.sizes[size];
  const outer = avatarSize + 2 * (width + gap);

  const chosen = palette ?? theme.ring.palette;
  const stops = Array.isArray(chosen) ? chosen : palettes[chosen][scheme];
  const gradientId = `ring-${ringId}`;

  const opacity = useSharedValue(seen ? 0 : 1);
  useEffect(() => {
    opacity.value = withTiming(seen ? 0 : 1, {
      duration: config.motion.seenRingMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [seen, opacity, config.motion.seenRingMs]);
  const gradientProps = useAnimatedProps(() => ({ opacity: opacity.value }));

  return (
    <View style={{ width: outer, height: outer }}>
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
