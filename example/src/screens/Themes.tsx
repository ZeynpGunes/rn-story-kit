import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  StoryList,
  StoryProvider,
  palettes,
  type ColorScheme,
  type PaletteName,
} from 'rn-story-kit';
import { makeUsers } from '../data';

const NAMES = Object.keys(palettes) as PaletteName[];

export function Themes() {
  const users = useMemo(makeUsers, []);
  const [palette, setPalette] = useState<PaletteName>('classic');
  const [scheme, setScheme] = useState<ColorScheme>('light');
  const theme = useMemo(() => ({ ring: { palette } }), [palette]);
  const dark = scheme === 'dark';

  return (
    <StoryProvider users={users} theme={theme} scheme={scheme}>
      <View style={[styles.root, dark && styles.rootDark]}>
        <StoryList />
        <ScrollView contentContainerStyle={styles.controls}>
          <Text style={[styles.label, dark && styles.textDark]}>Palette</Text>
          <View style={styles.row}>
            {NAMES.map((n) => (
              <Chip
                key={n}
                label={n}
                active={n === palette}
                onPress={() => setPalette(n)}
              />
            ))}
          </View>
          <Text style={[styles.label, dark && styles.textDark]}>Scheme</Text>
          <View style={styles.row}>
            {(['light', 'dark'] as const).map((s) => (
              <Chip
                key={s}
                label={s}
                active={s === scheme}
                onPress={() => setScheme(s)}
              />
            ))}
          </View>
        </ScrollView>
      </View>
    </StoryProvider>
  );
}

function Chip(p: { label: string; active: boolean; onPress(): void }) {
  return (
    <Pressable
      onPress={p.onPress}
      style={[styles.chip, p.active && styles.chipActive]}
    >
      <Text style={p.active ? styles.chipTextActive : styles.chipText}>
        {p.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 12, backgroundColor: '#fff' },
  rootDark: { backgroundColor: '#000' },
  controls: { padding: 16, gap: 8 },
  label: { fontWeight: '600', marginTop: 8 },
  textDark: { color: '#fff' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#e5e5ea',
  },
  chipActive: { backgroundColor: '#111' },
  chipText: { color: '#111' },
  chipTextActive: { color: '#fff' },
});
