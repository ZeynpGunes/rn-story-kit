import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import {
  StoryList,
  StoryProvider,
  createMMKVSeenStorage,
  type StoryItem,
  type StoryUser,
} from 'rn-story-kit';
import { makeUsers } from '../data';

const mmkv = createMMKV();
const seenStorage = createMMKVSeenStorage(mmkv);

export function Feed() {
  const [users, setUsers] = useState(makeUsers);
  const [last, setLast] = useState('none yet');
  const note = useMemo(() => last, [last]);

  const onLike = useCallback(
    (story: StoryItem, user: StoryUser, nextLiked: boolean) => {
      setLast(`${nextLiked ? 'liked' : 'unliked'} ${user.name}/${story.id}`);
      setUsers((prev) =>
        prev.map((u) =>
          u.id !== user.id
            ? u
            : {
                ...u,
                stories: u.stories.map((s) =>
                  s.id === story.id ? { ...s, liked: nextLiked } : s
                ),
              }
        )
      );
    },
    []
  );

  return (
    <StoryProvider
      users={users}
      seenStorage={seenStorage}
      scheme="system"
      onLike={onLike}
      onSendMessage={(story, user, text) =>
        setLast(`msg → ${user.name}: ${text}`)
      }
      onVoice={(story, user) => setLast(`voice → ${user.name}/${story.id}`)}
      onShare={(story, user) => setLast(`share → ${user.name}/${story.id}`)}
    >
      <View style={styles.root}>
        <StoryList />
        <Text style={styles.note}>
          Own story (you): view/like counts. Others: reply bar. Last action:{' '}
          {note}
        </Text>
      </View>
    </StoryProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 12 },
  note: { padding: 16, color: '#666' },
});
