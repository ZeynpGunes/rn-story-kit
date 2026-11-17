import { useCallback, useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { measureWithTimeout } from '../provider/rectRegistry';
import { useStoryContext } from '../provider/StoryProvider';
import { useStoryTheme } from '../theme/StoryThemeProvider';
import type { Rect, StoryUser } from '../types';
import { bubbleLabel, suggestedBubbleLabel } from '../viewer/a11y';
import { DismissButton, FollowButton } from './SuggestedBadges';
import { StoryRing } from './StoryRing';

export function StoryBubble({
  user,
  seen,
}: {
  user: StoryUser;
  seen: boolean;
}) {
  const theme = useStoryTheme();
  const { registry, api, config, hiddenUserId, onAddStory, followedIds } =
    useStoryContext();
  const ringRef = useRef<ComponentRef<typeof View>>(null);
  const { name } = theme.list;
  const isOwner = user.isOwner === true;
  const isEmptyOwner =
    isOwner && user.stories.length === 0 && config.ownerBubble.showAddWhenEmpty;
  const isSuggested = user.suggested === true && !isOwner;
  const showFollow = isSuggested && !followedIds.has(user.id);
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
      : isSuggested
        ? suggestedBubbleLabel(config.strings, user.name, user.stories.length)
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
          seen={seen}
          showRing={!isEmptyOwner}
          palette={user.ringColors ?? user.ringVariant}
          avatar={user.avatar}
          ringId={user.id}
        />
        {isEmptyOwner && <AddBadge />}
        {isSuggested && (
          <DismissButton
            user={user}
            size={theme.list.suggested.circle.closeSize}
            style={styles.dismissCircle}
          />
        )}
        {showFollow && (
          <FollowButton
            user={user}
            size={theme.list.suggested.circle.followSize}
            style={styles.followCircle}
          />
        )}
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
  dismissCircle: { top: 0, right: 0 },
  followCircle: { bottom: 0, right: 0 },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
