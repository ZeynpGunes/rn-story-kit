import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import { StoryList, StoryProvider, createMMKVSeenStorage } from 'rn-story-kit';
import { makeUsers } from '../data';

const mmkv = createMMKV();
const seenStorage = createMMKVSeenStorage(mmkv);

export function Feed() {
  const users = useMemo(makeUsers, []);
  return (
    <StoryProvider users={users} seenStorage={seenStorage} scheme="system">
      <View style={styles.root}>
        <StoryList />
        <Text style={styles.note}>
          Seen state is saved in MMKV and survives app restarts.
        </Text>
      </View>
    </StoryProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 12 },
  note: { padding: 16, color: '#666' },
});
