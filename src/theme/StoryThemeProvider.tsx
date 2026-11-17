import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import type { ColorScheme, DeepPartial, StoryTheme } from '../types';
import { mergeTheme } from './mergeTheme';
import { darkTheme, lightTheme } from './tokens';

const StoryThemeContext = createContext<StoryTheme>(lightTheme);

export function StoryThemeProvider({
  theme,
  scheme = 'system',
  children,
}: {
  theme?: DeepPartial<StoryTheme>;
  scheme?: ColorScheme | 'system';
  children?: ReactNode;
}) {
  const system = useColorScheme();
  const resolved: ColorScheme =
    scheme === 'system' ? (system === 'dark' ? 'dark' : 'light') : scheme;
  const value = useMemo(
    () => mergeTheme(resolved === 'dark' ? darkTheme : lightTheme, theme),
    [resolved, theme]
  );
  return (
    <StoryThemeContext.Provider value={value}>
      {children}
    </StoryThemeContext.Provider>
  );
}

export function useStoryTheme(): StoryTheme {
  return useContext(StoryThemeContext);
}
