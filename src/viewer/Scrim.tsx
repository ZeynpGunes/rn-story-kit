import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/** Top scrim: safeAreaTop + 96 tall, 0.55 -> 0.18 (at 60%) -> transparent. */
export function Scrim({ safeAreaTop }: { safeAreaTop: number }) {
  // Unique per instance — shared ids collide across pager pages and tint wrong.
  const id = `topScrim${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg
      pointerEvents="none"
      style={[styles.scrim, { height: safeAreaTop + 96 }]}
      width="100%"
      height="100%"
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity={0.55} />
          <Stop offset="0.6" stopColor="#000" stopOpacity={0.18} />
          <Stop offset="1" stopColor="#000" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
});

/** Optional bottom scrim behind a footer: 120px, transparent -> 0.45 black. */
export function BottomScrim() {
  const id = `bottomScrim${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg
      pointerEvents="none"
      style={styles.bottomScrim}
      width="100%"
      height="100%"
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000" stopOpacity={0.45} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
