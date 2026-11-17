import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useStoryTheme } from '../theme/StoryThemeProvider';
import type { StoryItem } from '../types';
import { likeCountLabel, viewCountLabel } from './a11y';
import {
  EngagementModal,
  type EngagementKind,
} from './EngagementModal';

export interface OwnerInsightsBarProps {
  story: StoryItem;
  pause(): void;
  resume(): void;
}

/** Own-story footer: view and like counts that open the people modal. */
export function OwnerInsightsBar({
  story,
  pause,
  resume,
}: OwnerInsightsBarProps) {
  const { actions } = useStoryTheme();
  const c = actions.count;
  const [kind, setKind] = useState<EngagementKind | null>(null);

  const views = story.viewCount ?? 0;
  const likes = story.likeCount ?? 0;
  const people =
    kind === 'viewers' ? (story.viewers ?? []) : (story.likers ?? []);

  const open = (next: EngagementKind) => {
    pause();
    setKind(next);
  };
  const close = () => {
    setKind(null);
    resume();
  };

  return (
    <>
      <View
        testID="owner-insights"
        style={[styles.row, { paddingHorizontal: actions.sideInset }]}
      >
        <Pressable
          testID="owner-views"
          accessibilityRole="button"
          accessibilityLabel={viewCountLabel(views)}
          onPress={() => open('viewers')}
          style={[styles.chip, { gap: 6 }]}
        >
          <EyeIcon size={c.icon} color={c.color} />
          <Text
            style={{
              fontSize: c.size,
              lineHeight: c.lineHeight,
              fontWeight: c.weight as '600',
              color: c.color,
            }}
          >
            {views}
          </Text>
        </Pressable>
        <Pressable
          testID="owner-likes"
          accessibilityRole="button"
          accessibilityLabel={likeCountLabel(likes)}
          onPress={() => open('likers')}
          style={[styles.chip, { gap: 6, marginLeft: c.gap }]}
        >
          <HeartIcon size={c.icon} color={c.color} filled={false} />
          <Text
            style={{
              fontSize: c.size,
              lineHeight: c.lineHeight,
              fontWeight: c.weight as '600',
              color: c.color,
            }}
          >
            {likes}
          </Text>
        </Pressable>
      </View>
      <EngagementModal kind={kind} people={people} onClose={close} />
    </>
  );
}

function EyeIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
      />
    </Svg>
  );
}

export function HeartIcon({
  size,
  color,
  filled,
}: {
  size: number;
  color: string;
  filled: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 21s-7.2-4.35-9.6-8.4C.6 9.3 2.1 5.7 5.4 5.1c1.95-.35 3.75.6 4.8 2.1 1.05-1.5 2.85-2.45 4.8-2.1 3.3.6 4.8 4.2 3 7.5C19.2 16.65 12 21 12 21z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  chip: { flexDirection: 'row', alignItems: 'center' },
});
