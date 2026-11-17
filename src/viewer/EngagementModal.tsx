import { Image } from 'expo-image';
import { useEffect } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useStoryTheme } from '../theme/StoryThemeProvider';
import { useStoryContext } from '../provider/StoryProvider';
import type { StoryPerson } from '../types';
import { followPersonLabel } from './a11y';
import { HeartIcon } from './icons';

export type EngagementKind = 'viewers' | 'likers';

export interface EngagementModalProps {
  kind: EngagementKind | null;
  people: StoryPerson[];
  onClose(): void;
  onFollow?(person: StoryPerson): void;
}

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;

/** Bottom sheet-style modal listing people who viewed or liked a story. */
export function EngagementModal({
  kind,
  people,
  onClose,
  onFollow,
}: EngagementModalProps) {
  const { actions } = useStoryTheme();
  const { config } = useStoryContext();
  const s = config.strings;
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const m = actions.modal;
  const f = m.follow;
  const open = kind !== null;
  const title =
    kind === 'viewers'
      ? s.viewersTitle
      : kind === 'likers'
        ? s.likesTitle
        : '';
  const empty =
    kind === 'viewers' ? s.noViewers : kind === 'likers' ? s.noLikes : '';

  const translateY = useSharedValue(0);
  const backdrop = useSharedValue(1);

  useEffect(() => {
    if (open) {
      translateY.value = 0;
      backdrop.value = 1;
    }
  }, [open, translateY, backdrop]);

  const dismiss = () => {
    'worklet';
    const off = height;
    backdrop.value = withTiming(0, { duration: 220 });
    translateY.value = withTiming(off, { duration: 220 }, (finished) => {
      if (finished) scheduleOnRN(onClose);
    });
  };

  const requestClose = () => {
    dismiss();
  };

  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-24, 24])
    .onUpdate((e) => {
      const y = Math.max(0, e.translationY);
      translateY.value = y;
      backdrop.value = 1 - Math.min(1, y / 280);
    })
    .onEnd((e) => {
      if (translateY.value > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        dismiss();
        return;
      }
      translateY.value = withSpring(0, {
        damping: 22,
        stiffness: 260,
        mass: 0.9,
      });
      backdrop.value = withSpring(1, {
        damping: 22,
        stiffness: 260,
        mass: 0.9,
      });
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
  }));

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={requestClose}
    >
      <GestureHandlerRootView style={styles.root} testID="engagement-modal">
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={requestClose}
            accessibilityRole="button"
            accessibilityLabel={s.closeList}
          />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              styles.sheet,
              {
                backgroundColor: m.bg,
                paddingBottom: Math.max(insets.bottom, 16),
              },
              sheetStyle,
            ]}
          >
            <View style={styles.grab}>
              <View style={[styles.handle, { backgroundColor: m.handle }]} />
            </View>
            <View style={styles.titleRow}>
              <Text
                style={{
                  flex: 1,
                  fontSize: m.titleSize,
                  fontWeight: '600',
                  color: m.titleColor,
                }}
              >
                {title}
              </Text>
              <Pressable
                onPress={requestClose}
                accessibilityRole="button"
                accessibilityLabel={s.closeList}
                hitSlop={8}
                style={styles.closeHit}
              >
                <Svg width={22} height={22} viewBox="0 0 24 24">
                  <Path
                    d="M6 6L18 18M18 6L6 18"
                    stroke={m.closeColor}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </Svg>
              </Pressable>
            </View>
            {kind && people.length === 0 ? (
              <Text
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 24,
                  color: m.emptyColor,
                  fontSize: m.nameSize,
                }}
              >
                {empty}
              </Text>
            ) : (
              <FlatList
                data={people}
                keyExtractor={(p) => p.id}
                bounces={false}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  paddingBottom: 12,
                }}
                renderItem={({ item }) => {
                  const showFollow = item.following !== true;
                  return (
                    <View style={[styles.row, { minHeight: m.avatar + 16 }]}>
                      <View
                        style={{
                          width: m.avatar,
                          height: m.avatar,
                          marginRight: 12,
                        }}
                      >
                        <Image
                          source={{ uri: item.avatar }}
                          style={{
                            width: m.avatar,
                            height: m.avatar,
                            borderRadius: m.avatar / 2,
                            backgroundColor: 'rgba(255,255,255,0.08)',
                          }}
                        />
                        {kind === 'likers' && (
                          <View
                            testID={`liked-${item.id}`}
                            accessibilityLabel={s.liked}
                            style={[
                              styles.likedBadge,
                              {
                                backgroundColor: m.bg,
                                borderColor: m.bg,
                              },
                            ]}
                          >
                            <HeartIcon
                              size={m.likedIcon}
                              color={m.likedColor}
                              filled
                            />
                          </View>
                        )}
                      </View>
                      <Text
                        numberOfLines={1}
                        style={{
                          flex: 1,
                          marginRight: 12,
                          fontSize: m.nameSize,
                          fontWeight: '600',
                          color: m.nameColor,
                        }}
                      >
                        {item.name}
                      </Text>
                      <View style={styles.followSlot}>
                        {showFollow ? (
                          <Pressable
                            testID={`follow-${item.id}`}
                            accessibilityRole="button"
                            accessibilityLabel={followPersonLabel(s, item.name)}
                            onPress={() => onFollow?.(item)}
                            style={{
                              height: f.height,
                              paddingHorizontal: f.paddingH,
                              borderRadius: f.radius,
                              backgroundColor: f.bg,
                              alignItems: 'center',
                              justifyContent: 'center',
                              alignSelf: 'stretch',
                            }}
                          >
                            <Text
                              style={{
                                color: f.color,
                                fontSize: f.size,
                                fontWeight: f.weight as '600',
                              }}
                            >
                              {s.follow}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 4,
  },
  grab: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  closeHit: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  likedBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followSlot: {
    width: 96,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
});
