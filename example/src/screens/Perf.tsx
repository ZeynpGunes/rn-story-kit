import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StoryList, StoryProvider } from 'rn-story-kit';
import { makeManyUsers } from '../data';

/** Blocks the JS thread; animations on the UI thread should stay smooth. */
function blockJs(ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // busy loop
  }
}

export function Perf() {
  const users = useMemo(() => makeManyUsers(200), []);
  return (
    <StoryProvider users={users}>
      <View style={styles.root}>
        <StoryList />
        <Text style={styles.note}>
          200 users. Open a story, then press the button: the JS thread blocks
          for 3 seconds while the progress bar, cube and gestures keep running.
        </Text>
        <Pressable style={styles.btn} onPress={() => blockJs(3000)}>
          <Text style={styles.btnText}>Block JS thread (3s)</Text>
        </Pressable>
      </View>
    </StoryProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 12 },
  note: { padding: 16, color: '#666' },
  btn: {
    margin: 16,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#c0392b',
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '600' },
});
