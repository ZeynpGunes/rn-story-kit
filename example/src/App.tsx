import { useState, type ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { CustomHeader } from './screens/CustomHeader';
import { Feed } from './screens/Feed';
import { Perf } from './screens/Perf';
import { Themes } from './screens/Themes';

const SCREENS: Record<string, ComponentType> = {
  Feed,
  Themes,
  CustomHeader,
  Perf,
};

function Tabs() {
  const [name, setName] = useState('Feed');
  const insets = useSafeAreaInsets();
  const Screen = SCREENS[name]!;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.tabs}>
        {Object.keys(SCREENS).map((n) => (
          <Pressable
            key={n}
            onPress={() => setName(n)}
            style={[styles.tab, n === name && styles.tabActive]}
          >
            <Text style={n === name ? styles.tabTextActive : styles.tabText}>
              {n}
            </Text>
          </Pressable>
        ))}
      </View>
      <Screen key={name} />
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <Tabs />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: '#fff' },
  tabs: { flexDirection: 'row', padding: 8, gap: 6 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#e5e5ea',
  },
  tabActive: { backgroundColor: '#111' },
  tabText: { fontSize: 12, color: '#111' },
  tabTextActive: { fontSize: 12, color: '#fff' },
});
