import { useCallback, useEffect, useRef, type ComponentRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { measureWithTimeout } from '../provider/rectRegistry';
import { useStoryContext } from '../provider/StoryProvider';
import { useStoryTheme } from '../theme/StoryThemeProvider';
import type { StoryListVariant } from '../config';
import type { Rect, StoryUser } from '../types';
import { bubbleLabel, suggestedBubbleLabel } from '../viewer/a11y';
import { DismissButton, FollowButton } from './SuggestedBadges';
import { StoryCardRing } from './StoryCardRing';
import { StoryRing } from './StoryRing';

export function StoryBubble({
  user,
  seen,
  variant = 'circle',
}: {
  user: StoryUser;
  seen: boolean;
  variant?: StoryListVariant;
}) {
  const theme = useStoryTheme();
  const { registry, api, config, hiddenUserId, onAddStory, followedIds } =
    useStoryContext();
  const ringRef = useRef<ComponentRef<typeof View>>(null);
  const { name, card, suggested } = theme.list;
  const isCard = variant === 'card';
  const cardInset = card.ringWidth + card.gap;
  const cardOuterW = card.width + 2 * cardInset;
  const cardOuterRadius = card.radius + cardInset;
  const cardAddStyle: ViewStyle = {
    bottom: cardInset + suggested.follow.inset,
    alignSelf: 'center',
  };
  const cardDismissStyle: ViewStyle = {
    top: cardInset + suggested.close.inset,
    right: cardInset + suggested.close.inset,
  };
  const cardFollowStyle: ViewStyle = {
    bottom: cardInset + suggested.follow.inset,
    right: cardInset + suggested.follow.inset,
  };
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
          resolve({
            x,
            y,
            width,
            height,
            radius: isCard ? cardOuterRadius : width / 2,
          })
        );
      }),
    [isCard, cardOuterRadius]
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
        {
          width: isCard ? cardOuterW : theme.list.itemWidth,
          alignSelf: 'flex-start',
        },
        hiddenUserId === user.id && styles.hidden,
      ]}
    >
      <View ref={ringRef} collapsable={false} style={styles.ringWrap}>
        {isCard ? (
          <StoryCardRing
            seen={seen}
            showRing={!isEmptyOwner}
            palette={user.ringColors ?? user.ringVariant}
            cover={user.cover ?? user.avatar}
            ringId={user.id}
          />
        ) : (
          <StoryRing
            size={theme.list.bubble}
            seen={seen}
            showRing={!isEmptyOwner}
            palette={user.ringColors ?? user.ringVariant}
            avatar={user.avatar}
            ringId={user.id}
          />
        )}
        {isEmptyOwner && (
          <AddBadge
            size={isCard ? suggested.follow.size : undefined}
            style={isCard ? cardAddStyle : undefined}
          />
        )}
        {isSuggested && (
          <DismissButton
            user={user}
            size={isCard ? suggested.close.size : suggested.circle.closeSize}
            style={isCard ? cardDismissStyle : styles.dismissCircle}
          />
        )}
        {showFollow && (
          <FollowButton
            user={user}
            size={isCard ? suggested.follow.size : suggested.circle.followSize}
            style={isCard ? cardFollowStyle : styles.followCircle}
          />
        )}
      </View>
      <Text
        numberOfLines={name.lines}
        ellipsizeMode={name.ellipsizeMode}
        style={{
          marginTop: isCard ? card.labelMarginTop : name.marginTop,
          maxWidth: isCard ? cardOuterW : name.maxWidth,
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

function AddBadge({ size, style }: { size?: number; style?: ViewStyle }) {
  const { list } = useStoryTheme();
  const b = { ...list.addBadge, size: size ?? list.addBadge.size };
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
        style,
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
