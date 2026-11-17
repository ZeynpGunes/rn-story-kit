import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import {
  StoryList,
  StoryProvider,
  createMMKVSeenStorage,
  type StoryItem,
  type StoryPerson,
  type StoryUser,
} from 'rn-story-kit';
import { makeUsers } from '../data';

const mmkv = createMMKV();
const seenStorage = createMMKVSeenStorage(mmkv);

const markFollowing = (list: StoryPerson[] | undefined, id: string) =>
  list?.map((p) => (p.id === id ? { ...p, following: true } : p));

export function Feed() {
  const [users, setUsers] = useState(makeUsers);
  const [variant, setVariant] = useState<'circle' | 'card'>('circle');
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

  const onFollow = useCallback((person: StoryPerson) => {
    setLast(`follow → ${person.name}`);
    setUsers((prev) =>
      prev.map((u) => ({
        ...u,
        stories: u.stories.map((s) => ({
          ...s,
          viewers: markFollowing(s.viewers, person.id),
          likers: markFollowing(s.likers, person.id),
        })),
      }))
    );
  }, []);

  const clearOwnStories = () => {
    setUsers((prev) =>
      prev.map((u) => (u.isOwner ? { ...u, stories: [] } : u))
    );
    setLast('own stories cleared — tap + to add');
  };

  return (
    <StoryProvider
      users={users}
      seenStorage={seenStorage}
      scheme="system"
      config={{
        strings: {
          follow: 'Takip Et',
          followPerson: '{name} hesabını takip et',
          viewersTitle: 'Görüntüleyenler',
          likesTitle: 'Beğeniler',
          noViewers: 'Henüz görüntüleyen yok',
          noLikes: 'Henüz beğeni yok',
          replyPlaceholder: 'Mesaj gönder...',
          yourStory: 'Hikayen',
          addStory: 'Hikaye ekle',
        },
      }}
      onLike={onLike}
      onFollow={onFollow}
      onDismissSuggestion={(user) =>
        setLast(`dismiss suggestion → ${user.name}`)
      }
      onAddStory={() => setLast('onAddStory → open your create screen')}
      onSendMessage={(_story, user, text) =>
        setLast(`msg → ${user.name}: ${text}`)
      }
      onVoice={(story, user) => setLast(`voice → ${user.name}/${story.id}`)}
      onShare={(story, user) => setLast(`share → ${user.name}/${story.id}`)}
    >
      <View style={styles.root}>
        <StoryList variant={variant} />
        <Pressable
          onPress={() => setVariant(variant === 'circle' ? 'card' : 'circle')}
          style={styles.link}
        >
          <Text style={styles.linkText}>
            Variant: {variant} (tap to toggle)
          </Text>
        </Pressable>
        <Pressable onPress={clearOwnStories} style={styles.link}>
          <Text style={styles.linkText}>Demo: clear own stories (show +)</Text>
        </Pressable>
        <Text style={styles.note}>
          Own bubble = Hikayen. Empty = +. Last: {note}
        </Text>
      </View>
    </StoryProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 12 },
  note: { padding: 16, color: '#666' },
  link: { paddingHorizontal: 16, paddingTop: 8 },
  linkText: { color: '#3797F0', fontWeight: '600' },
});
