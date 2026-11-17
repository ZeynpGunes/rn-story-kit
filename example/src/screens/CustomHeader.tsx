import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StoryList, StoryProvider, type StorySlotProps } from 'rn-story-kit';
import { makeUsers } from '../data';

export function CustomHeader() {
  const users = useMemo(makeUsers, []);
  const [last, setLast] = useState('none yet');

  return (
    <StoryProvider
      users={users}
      onSwipeUp={(story, user) => setLast(`${user.name} / ${story.id}`)}
      renderHeader={({ user, close }: StorySlotProps) => (
        <View style={styles.header}>
          <Text style={styles.title}>{user.name.toUpperCase()}</Text>
          <Pressable onPress={close} accessibilityLabel="Close">
            <Text style={styles.title}>Done</Text>
          </Pressable>
        </View>
      )}
      renderFooter={({ story, pause, resume }: StorySlotProps) => (
        <View style={styles.footer}>
          <Text style={styles.title}>{story.alt ?? story.id}</Text>
          <Pressable onPressIn={pause} onPressOut={resume} style={styles.btn}>
            <Text style={styles.title}>Hold to pause</Text>
          </Pressable>
        </View>
      )}
    >
      <View style={styles.root}>
        <StoryList />
        <Text style={styles.note}>Last swipe up: {last}</Text>
      </View>
    </StoryProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 12 },
  note: { padding: 16, color: '#666' },
  header: {
    marginTop: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footer: { position: 'absolute', bottom: 40, left: 16, right: 16, gap: 12 },
  btn: {
    alignSelf: 'flex-start',
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  title: { color: '#fff', fontWeight: '600' },
});
