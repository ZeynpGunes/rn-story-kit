import { useMemo, type ReactElement } from 'react';
import { FlatList, type ViewStyle } from 'react-native';
import { useSeenVersion, useStoryContext } from '../provider/StoryProvider';
import { isUserSeen, sortUsers, visibleUsers } from '../seen/selectors';
import { useStoryTheme } from '../theme/StoryThemeProvider';
import type { StoryListVariant } from '../config';
import { StoryBubble } from './StoryBubble';

export interface StoryListProps {
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  ListHeaderComponent?: ReactElement;
  /** Bubble shape. Defaults to `config.list.variant` (circle). */
  variant?: StoryListVariant;
}

export function StoryList({
  style,
  contentContainerStyle,
  ListHeaderComponent,
  variant,
}: StoryListProps = {}) {
  const theme = useStoryTheme();
  const { users, store, config, onEndReached, dismissedIds } =
    useStoryContext();
  const version = useSeenVersion();

  const data = useMemo(
    () =>
      sortUsers(
        visibleUsers(
          users.filter((u) => !dismissedIds.has(u.id)),
          config.ownerBubble
        ),
        store,
        config.sortUnseenFirst,
        config.ownerBubble
      ),
    // version: re-sort when seen state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      users,
      dismissedIds,
      store,
      config.sortUnseenFirst,
      config.ownerBubble,
      version,
    ]
  );

  if (data.length === 0) return null;

  return (
    <FlatList
      testID="story-list"
      horizontal
      showsHorizontalScrollIndicator={false}
      data={data}
      extraData={version}
      keyExtractor={(u) => u.id}
      // Don't stretch to the parent height — otherwise each bubble's
      // Pressable fills the screen and taps below the row open stories.
      style={[{ flexGrow: 0 }, style]}
      contentContainerStyle={[
        {
          paddingHorizontal: theme.list.paddingH,
          gap: theme.list.gap,
          alignItems: 'flex-start',
        },
        contentContainerStyle,
      ]}
      ListHeaderComponent={ListHeaderComponent}
      onEndReached={onEndReached}
      renderItem={({ item }) => (
        <StoryBubble
          user={item}
          seen={isUserSeen(item, store)}
          variant={variant ?? config.list.variant}
        />
      )}
    />
  );
}
