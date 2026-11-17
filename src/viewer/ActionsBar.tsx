import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { StoryActionsConfig } from '../config';
import { useStoryContext } from '../provider/StoryProvider';
import { useStoryTheme } from '../theme/StoryThemeProvider';
import type { StoryItem, StoryUser } from '../types';
import { likeActionLabel } from './a11y';
import { HeartIcon } from './icons';

export interface ActionsBarProps {
  user: StoryUser;
  story: StoryItem;
  actions: StoryActionsConfig;
  pause(): void;
  resume(): void;
  onLike?(story: StoryItem, user: StoryUser, nextLiked: boolean): void;
  onSendMessage?(story: StoryItem, user: StoryUser, text: string): void;
  onVoice?(story: StoryItem, user: StoryUser): void;
  onShare?(story: StoryItem, user: StoryUser): void;
}

/** Instagram-style reply / like / voice / share row for others' stories. */
export function ActionsBar({
  user,
  story,
  actions,
  pause,
  resume,
  onLike,
  onSendMessage,
  onVoice,
  onShare,
}: ActionsBarProps) {
  const { actions: t } = useStoryTheme();
  const { config } = useStoryContext();
  const s = config.strings;
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const liked = story.liked === true;

  const any = actions.message || actions.like || actions.voice || actions.share;
  if (!any) return null;

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendMessage?.(story, user, trimmed);
    setText('');
  };

  return (
    <View
      testID="actions-bar"
      style={[
        styles.row,
        {
          paddingHorizontal: t.sideInset,
          gap: t.gap,
          paddingVertical: 10,
        },
      ]}
    >
      {actions.message && (
        <TextInput
          testID="actions-message"
          value={text}
          onChangeText={setText}
          placeholder={s.replyPlaceholder}
          placeholderTextColor={t.input.placeholder}
          onFocus={() => {
            setFocused(true);
            pause();
          }}
          onBlur={() => {
            setFocused(false);
            resume();
          }}
          onSubmitEditing={send}
          returnKeyType="send"
          accessibilityLabel={s.sendMessage}
          style={{
            flex: 1,
            height: t.input.height,
            borderRadius: t.input.radius,
            paddingHorizontal: t.input.paddingH,
            backgroundColor: t.input.bg,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: t.input.border,
            color: t.input.color,
            fontSize: t.input.size,
          }}
        />
      )}
      {actions.like && (
        <IconButton
          testID="actions-like"
          label={likeActionLabel(s, liked)}
          size={t.icon.hit}
          onPress={() => onLike?.(story, user, !liked)}
        >
          <HeartIcon
            size={t.icon.size}
            color={liked ? t.icon.liked : t.icon.color}
            filled={liked}
          />
        </IconButton>
      )}
      {actions.voice && (
        <IconButton
          testID="actions-voice"
          label={s.voiceMessage}
          size={t.icon.hit}
          onPress={() => onVoice?.(story, user)}
        >
          <MicIcon size={t.icon.size} color={t.icon.color} />
        </IconButton>
      )}
      {actions.share && (
        <IconButton
          testID="actions-share"
          label={s.shareStory}
          size={t.icon.hit}
          onPress={() => {
            if (focused && text.trim()) {
              send();
              return;
            }
            onShare?.(story, user);
          }}
        >
          <ShareIcon size={t.icon.size} color={t.icon.color} />
        </IconButton>
      )}
    </View>
  );
}

function IconButton({
  children,
  onPress,
  label,
  size,
  testID,
}: {
  children: ReactNode;
  onPress(): void;
  label: string;
  size: number;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </Pressable>
  );
}

function MicIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3z"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
      />
      <Path
        d="M5 11a7 7 0 0014 0M12 18v3"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function ShareIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
