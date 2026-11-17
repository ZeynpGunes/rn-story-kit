import { useCallback, useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { measureWithTimeout } from '../provider/rectRegistry';
import { useStoryContext } from '../provider/StoryProvider';
import { useStoryTheme } from '../theme/StoryThemeProvider';
import type { Rect, StoryUser } from '../types';
import { bubbleLabel } from '../viewer/a11y';
import { StoryRing } from './StoryRing';

export function StoryBubble({
  user,
  seen,
}: {
  user: StoryUser;
  seen: boolean;
}) {
  const theme = useStoryTheme();
  const { registry, api, config, hiddenUserId } = useStoryContext();
  const ringRef = useRef<ComponentRef<typeof View>>(null);
  const { name } = theme.list;

  const measure = useCallback(
    () =>
      new Promise<Rect | null>((resolve) => {
        if (!ringRef.current) return resolve(null);
        ringRef.current.measureInWindow((x, y, width, height) =>
          resolve({ x, y, width, height })
        );
      }),
    []
  );
  useEffect(
    () => registry.register(user.id, measure),
    [registry, user.id, measure]
  );

  const onPress = async () => {
    const rect = await measureWithTimeout(
      registry,
      user.id,
      config.motion.measureTimeoutMs
    );
    api.open(user.id, rect ?? undefined);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={bubbleLabel(
        config.strings,
        user.name,
        seen,
        user.stories.length
      )}
      onPress={onPress}
      testID={`bubble-${user.id}`}
      style={[
        styles.item,
        { width: theme.list.itemWidth },
        hiddenUserId === user.id && styles.hidden,
      ]}
    >
      <View ref={ringRef} collapsable={false}>
        <StoryRing
          size={theme.list.bubble}
          seen={seen}
          palette={user.ringColors ?? user.ringVariant}
          avatar={user.avatar}
          ringId={user.id}
        />
      </View>
      <Text
        numberOfLines={name.lines}
        ellipsizeMode={name.ellipsizeMode}
        style={{
          marginTop: name.marginTop,
          maxWidth: name.maxWidth,
          fontSize: name.size,
          lineHeight: name.lineHeight,
          fontWeight: name.weight as '400',
          textAlign: name.align,
          color: seen ? name.seenColor : name.color,
        }}
      >
        {user.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: 'center' },
  hidden: { opacity: 0 },
});
