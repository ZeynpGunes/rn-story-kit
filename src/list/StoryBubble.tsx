import { useCallback, useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
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
  const { registry, api, config, hiddenUserId, onAddStory } = useStoryContext();
  const ringRef = useRef<ComponentRef<typeof View>>(null);
  const { name } = theme.list;
  const isOwner = user.isOwner === true;
  const isEmptyOwner =
    isOwner &&
    user.stories.length === 0 &&
    config.ownerBubble.showAddWhenEmpty;
  const label = isOwner ? config.strings.yourStory : user.name;

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
    if (isEmptyOwner) {
      onAddStory();
      return;
    }
    const rect = await measureWithTimeout(
      registry,
      user.id,
      config.motion.measureTimeoutMs
    );
    api.open(user.id, rect ?? undefined);
  };

  const a11y = isEmptyOwner
    ? config.strings.addStory
    : isOwner
      ? bubbleLabel(
          config.strings,
          config.strings.yourStory,
          seen,
          user.stories.length
        )
      : bubbleLabel(config.strings, user.name, seen, user.stories.length);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      testID={`bubble-${user.id}`}
      style={[
        styles.item,
        { width: theme.list.itemWidth, alignSelf: 'flex-start' },
        hiddenUserId === user.id && styles.hidden,
      ]}
    >
      <View ref={ringRef} collapsable={false} style={styles.ringWrap}>
        <StoryRing
          size={theme.list.bubble}
          seen={isEmptyOwner ? true : seen}
          palette={user.ringColors ?? user.ringVariant}
          avatar={user.avatar}
          ringId={user.id}
        />
        {isEmptyOwner && <AddBadge />}
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
          color: seen && !isEmptyOwner ? name.seenColor : name.color,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function AddBadge() {
  const { list } = useStoryTheme();
  const b = list.addBadge;
  return (
    <View
      testID="owner-add-badge"
      pointerEvents="none"
      style={[
        styles.badge,
        {
          width: b.size,
          height: b.size,
          borderRadius: b.size / 2,
          backgroundColor: b.bg,
          borderColor: b.border,
          borderWidth: b.borderWidth,
        },
      ]}
    >
      <Svg width={b.size * 0.55} height={b.size * 0.55} viewBox="0 0 24 24">
        <Path
          d="M12 5v14M5 12h14"
          stroke={b.icon}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: 'center' },
  hidden: { opacity: 0 },
  ringWrap: { position: 'relative' },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
