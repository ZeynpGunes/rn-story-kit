import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { mediaGradient } from '../../color/thumbhash';
import { useStoryTheme } from '../../theme/StoryThemeProvider';
import type { StoryItem } from '../../types';

/** Vertical gradient behind the media, from colors / thumbhash / fallback. */
export function MediaBackground({ story }: { story: StoryItem }) {
  const { viewer } = useStoryTheme();
  const id = `bg${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const stops = mediaGradient(story, viewer.bgFallback);
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          {stops.map((color, i) => (
            <Stop
              key={i}
              offset={stops.length === 1 ? 0 : i / (stops.length - 1)}
              stopColor={color}
            />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
