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
import { DismissButton, FollowButton, MIN_HIT } from './SuggestedBadges';
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
  const cardOuterH = card.height + 2 * cardInset;
  const itemW = isCard ? cardOuterW : theme.list.itemWidth;
  const ringW = isCard
    ? cardOuterW
    : theme.list.bubble + 2 * (theme.ring.width + theme.ring.gap);
  const ringH = isCard ? cardOuterH : ringW;
  // Badges are siblings of the bubble Pressable (so a screen reader can reach
  // them), placed in item coordinates over the ring.
  const ringLeft = (itemW - ringW) / 2;
  const closeSize = isCard ? suggested.close.size : suggested.circle.closeSize;
  const followSize = isCard
    ? suggested.follow.size
    : suggested.circle.followSize;
  const closeInset = isCard ? cardInset + suggested.close.inset : 0;
  const followInset = isCard ? cardInset + suggested.follow.inset : 0;
  // Keep each badge's 44x44 touch area inside the item, or the platform
  // drops touches that land outside the parent's bounds.
  const itemH =
    ringH + (isCard ? card.labelMarginTop : name.marginTop) + name.lineHeight;
  const placeBadge = (left: number, top: number, size: number): ViewStyle => {
    const slop = Math.max(0, (MIN_HIT - size) / 2);
    return {
      left: Math.min(Math.max(left, slop), itemW - size - slop),
      top: Math.min(Math.max(top, slop), itemH - size - slop),
    };
  };
  const dismissStyle = placeBadge(
    ringLeft + ringW - closeInset - closeSize,
    closeInset,
    closeSize
  );
  const followStyle = placeBadge(
    ringLeft + ringW - followInset - followSize,
    ringH - followInset - followSize,
    followSize
  );
  const cardAddStyle: ViewStyle = {
    bottom: cardInset + suggested.follow.inset,
    left: (cardOuterW - suggested.follow.size) / 2,
    right: undefined,
  };
  const isOwner = user.isOwner === true;
  const isEmptyOwner =
    isOwner && user.stories.length === 0 && config.ownerBubble.showAddWhenEmpty;
  const isSuggested = user.suggested === true && !isOwner;
  const showFollow = isSuggested && !followedIds.has(user.id);
  const hidden = hiddenUserId === user.id;
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
      : showFollow
        ? suggestedBubbleLabel(config.strings, user.name, user.stories.length)
        : bubbleLabel(config.strings, user.name, seen, user.stories.length);

  return (
    <View
      testID={`bubble-wrap-${user.id}`}
      style={[styles.wrap, { width: itemW }, hidden && styles.hidden]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y}
        onPress={onPress}
        testID={`bubble-${user.id}`}
        style={[styles.item, { width: itemW }, hidden && styles.hidden]}
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
      {isSuggested && (
        <DismissButton
          user={user}
          size={closeSize}
          style={dismissStyle}
          borderColor={isCard ? undefined : suggested.circle.closeBorder}
        />
      )}
      {showFollow && (
        <FollowButton user={user} size={followSize} style={followStyle} />
      )}
    </View>
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
  wrap: { alignSelf: 'flex-start' },
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
