import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/** Top scrim: safeAreaTop + 96 tall, 0.55 -> 0.18 (at 60%) -> transparent. */
export function Scrim({ safeAreaTop }: { safeAreaTop: number }) {
  return (
    <Svg
      pointerEvents="none"
      style={[styles.scrim, { height: safeAreaTop + 96 }]}
      width="100%"
      height="100%"
    >
      <Defs>
        <LinearGradient id="story-top-scrim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity={0.55} />
          <Stop offset="0.6" stopColor="#000" stopOpacity={0.18} />
          <Stop offset="1" stopColor="#000" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#story-top-scrim)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0 },
});
