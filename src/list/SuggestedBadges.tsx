import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useStoryContext } from '../provider/StoryProvider';
import { fill } from '../strings';
import { useStoryTheme } from '../theme/StoryThemeProvider';
import type { StoryUser } from '../types';

const MIN_HIT = 44;

const hitSlopFor = (size: number) => {
  const slop = Math.max(0, (MIN_HIT - size) / 2);
  return { top: slop, bottom: slop, left: slop, right: slop };
};

/**
 * Round tappable badge. A Pressable of its own, so a tap here never reaches
 * the bubble's press (the viewer does not open).
 */
function RoundButton({
  testID,
  label,
  size,
  bg,
  style,
  onPress,
  children,
}: {
  testID: string;
  label: string;
  size: number;
  bg: string;
  style: ViewStyle;
  onPress(): void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={hitSlopFor(size)}
      onPress={onPress}
      style={[
        styles.round,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function FollowButton({
  user,
  size,
  style,
}: {
  user: StoryUser;
  size: number;
  style: ViewStyle;
}) {
  const { suggested } = useStoryTheme().list;
  const { config, followSuggested } = useStoryContext();
  const icon = size * 0.56;
  return (
    <RoundButton
      testID={`suggested-follow-${user.id}`}
      label={fill(config.strings.followSuggested, { name: user.name })}
      size={size}
      bg={suggested.follow.bg}
      style={style}
      onPress={() => followSuggested(user)}
    >
      <Svg width={icon} height={icon} viewBox="0 0 24 24">
        <Circle
          cx={9}
          cy={8}
          r={4}
          stroke={suggested.follow.icon}
          strokeWidth={2}
          fill="none"
        />
        <Path
          d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7M19 8v6M16 11h6"
          stroke={suggested.follow.icon}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </RoundButton>
  );
}

export function DismissButton({
  user,
  size,
  style,
}: {
  user: StoryUser;
  size: number;
  style: ViewStyle;
}) {
  const { suggested } = useStoryTheme().list;
  const { config, dismissSuggestion } = useStoryContext();
  const icon = size * 0.5;
  return (
    <RoundButton
      testID={`suggested-dismiss-${user.id}`}
      label={fill(config.strings.dismissSuggestion, { name: user.name })}
      size={size}
      bg={suggested.close.bg}
      style={style}
      onPress={() => dismissSuggestion(user)}
    >
      <Svg width={icon} height={icon} viewBox="0 0 24 24">
        <Path
          d="M5 5l14 14M19 5L5 19"
          stroke={suggested.close.icon}
          strokeWidth={2.6}
          strokeLinecap="round"
        />
      </Svg>
    </RoundButton>
  );
}

const styles = StyleSheet.create({
  round: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
