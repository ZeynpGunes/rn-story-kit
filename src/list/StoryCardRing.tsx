import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useStoryTheme } from '../theme/StoryThemeProvider';
import type { PaletteName } from '../types';
import { useRingStops, useSeenFade } from './ringShared';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export interface StoryCardRingProps {
  seen: boolean;
  palette?: PaletteName | string[];
  cover: string;
  ringId: string;
  /** When false, cover only: no gradient or grey border. Default true. */
  showRing?: boolean;
}

/** Tall rounded-rectangle counterpart of StoryRing. */
export function StoryCardRing({
  seen,
  palette,
  cover,
  ringId,
  showRing = true,
}: StoryCardRingProps) {
  const theme = useStoryTheme();
  const { width, height, radius, ringWidth, gap } = theme.list.card;
  const seenWidth = theme.ring.seenWidth;
  const inset = ringWidth + gap;
  const outerW = width + 2 * inset;
  const outerH = height + 2 * inset;
  const outerRadius = radius + inset;

  const stops = useRingStops(palette);
  const gradientId = `ring-${ringId}`;
  const gradientProps = useSeenFade(seen || !showRing);

  return (
    <View style={{ width: outerW, height: outerH }}>
      {showRing && (
        <View style={StyleSheet.absoluteFill}>
          <Svg width={outerW} height={outerH}>
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
            <Rect
              testID={`ring-seen-${ringId}`}
              x={seenWidth / 2}
              y={seenWidth / 2}
              width={outerW - seenWidth}
              height={outerH - seenWidth}
              rx={outerRadius - seenWidth / 2}
              fill="none"
              stroke={theme.ring.seen}
              strokeWidth={seenWidth}
            />
            <AnimatedRect
              testID={`ring-active-${ringId}`}
              x={ringWidth / 2}
              y={ringWidth / 2}
              width={outerW - ringWidth}
              height={outerH - ringWidth}
              rx={outerRadius - ringWidth / 2}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth={ringWidth}
              animatedProps={gradientProps}
            />
          </Svg>
        </View>
      )}
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Image
          source={cover}
          contentFit="cover"
          style={{
            width,
            height,
            borderRadius: radius,
            backgroundColor: theme.avatarPlaceholder,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
