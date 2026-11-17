import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useStoryTheme } from '../theme/StoryThemeProvider';
import type { StoryUser } from '../types';
import { closeLabel } from './a11y';

export interface HeaderProps {
  user: StoryUser;
  safeAreaTop: number;
  onClose(): void;
}

/** Default header: avatar + name row and an always-visible X. */
export function Header({ user, safeAreaTop, onClose }: HeaderProps) {
  const { header, progress } = useStoryTheme();
  const progressBottom = safeAreaTop + progress.topInset + progress.height;
  const { icon, hit, stroke, color, right } = header.closeBtn;
  const shadow = {
    textShadowColor: header.shadow.color,
    textShadowRadius: header.shadow.radius,
    textShadowOffset: { width: 0, height: header.shadow.offsetY },
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          styles.row,
          { top: progressBottom + header.marginTop, left: header.sideInset },
        ]}
      >
        <Image
          source={{ uri: user.avatar }}
          style={{
            width: header.avatar,
            height: header.avatar,
            borderRadius: header.avatar / 2,
          }}
        />
        <Text
          numberOfLines={1}
          style={[
            shadow,
            {
              marginLeft: header.gapAvatarName,
              fontSize: header.name.size,
              lineHeight: header.name.lineHeight,
              fontWeight: header.name.weight as '600',
              color: header.name.color,
            },
          ]}
        >
          {user.name}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        onPress={onClose}
        style={[
          styles.close,
          { top: progressBottom + 2, right, width: hit.w, height: hit.h },
        ]}
      >
        <Svg width={icon} height={icon} viewBox="0 0 24 24">
          <Path
            d="M6 6L18 18M18 6L6 18"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'absolute', flexDirection: 'row', alignItems: 'center' },
  close: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
