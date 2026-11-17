import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useStoryTheme } from '../theme/StoryThemeProvider';
import { useStoryContext } from '../provider/StoryProvider';
import type { StoryItem, StoryPerson } from '../types';
import { likeCountLabel, viewCountLabel } from './a11y';
import { EngagementModal, type EngagementKind } from './EngagementModal';
import { HeartIcon } from './icons';

export interface OwnerInsightsBarProps {
  story: StoryItem;
  pause(): void;
  resume(): void;
  onFollow?(person: StoryPerson): void;
}

/** Own-story footer: view and like counts that open the people modal. */
export function OwnerInsightsBar({
  story,
  pause,
  resume,
  onFollow,
}: OwnerInsightsBarProps) {
  const { actions } = useStoryTheme();
  const { config } = useStoryContext();
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
          accessibilityLabel={viewCountLabel(config.strings, views)}
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
          accessibilityLabel={likeCountLabel(config.strings, likes)}
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
      <EngagementModal
        kind={kind}
        people={people}
        onClose={close}
        onFollow={onFollow}
      />
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

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  chip: { flexDirection: 'row', alignItems: 'center' },
});
