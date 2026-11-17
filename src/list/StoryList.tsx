import { useMemo, type ReactElement } from 'react';
import { FlatList, type ViewStyle } from 'react-native';
import { useSeenVersion, useStoryContext } from '../provider/StoryProvider';
import { isUserSeen, sortUsers, visibleUsers } from '../seen/selectors';
import { useStoryTheme } from '../theme/StoryThemeProvider';
import { StoryBubble } from './StoryBubble';

export interface StoryListProps {
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  ListHeaderComponent?: ReactElement;
}

export function StoryList({
  style,
  contentContainerStyle,
  ListHeaderComponent,
}: StoryListProps = {}) {
  const theme = useStoryTheme();
  const { users, store, config, onEndReached } = useStoryContext();
  const version = useSeenVersion();

  const data = useMemo(
    () => sortUsers(visibleUsers(users), store, config.sortUnseenFirst),
    // version: re-sort when seen state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [users, store, config.sortUnseenFirst, version]
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
      style={style}
      contentContainerStyle={[
        { paddingHorizontal: theme.list.paddingH, gap: theme.list.gap },
        contentContainerStyle,
      ]}
      ListHeaderComponent={ListHeaderComponent}
      onEndReached={onEndReached}
      renderItem={({ item }) => (
        <StoryBubble user={item} seen={isUserSeen(item, store)} />
      )}
    />
  );
}
