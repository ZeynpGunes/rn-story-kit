import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { defaultConfig } from '../config';
import { mergeTheme } from '../theme/mergeTheme';
import { palettes } from '../theme/palettes';
import { StoryThemeProvider, useStoryTheme } from '../theme/StoryThemeProvider';
import { darkTheme, lightTheme } from '../theme/tokens';

describe('palettes', () => {
  it('has classic light stops', () => {
    expect(palettes.classic.light).toEqual([
      '#FFC247',
      '#FF8A3D',
      '#F2475F',
      '#C73CA8',
      '#FFC247',
    ]);
  });
  it('has mono dark stops', () => {
    expect(palettes.mono.dark).toEqual(['#FFFFFF', '#8E9097', '#FFFFFF']);
  });
});

describe('themes', () => {
  it('resolves seen ring per scheme', () => {
    expect(lightTheme.ring.seen).toBe('#C9CCD1');
    expect(darkTheme.ring.seen).toBe('#4A4D55');
  });
});

describe('mergeTheme', () => {
  it('overrides deeply without mutating base', () => {
    const merged = mergeTheme(lightTheme, { ring: { width: 4 } });
    expect(merged.ring.width).toBe(4);
    expect(merged.ring.gap).toBe(3);
    expect(lightTheme.ring.width).toBe(2.5);
  });
  it('returns base when no override', () => {
    expect(mergeTheme(lightTheme)).toBe(lightTheme);
  });
  it('replaces arrays instead of merging', () => {
    const merged = mergeTheme(lightTheme, {
      ring: { palette: ['#000', '#fff'] },
    });
    expect(merged.ring.palette).toEqual(['#000', '#fff']);
  });
});

describe('StoryThemeProvider', () => {
  it('provides dark theme for scheme=dark', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StoryThemeProvider scheme="dark">{children}</StoryThemeProvider>
    );
    const { result } = await renderHook(() => useStoryTheme(), { wrapper });
    expect(result.current.ring.seen).toBe('#4A4D55');
  });
  it('applies theme override', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StoryThemeProvider scheme="light" theme={{ ring: { width: 5 } }}>
        {children}
      </StoryThemeProvider>
    );
    const { result } = await renderHook(() => useStoryTheme(), { wrapper });
    expect(result.current.ring.width).toBe(5);
  });
});

describe('defaultConfig', () => {
  it('has swipe commit motion values', () => {
    expect(defaultConfig.motion.swipeCommitDistanceRatio).toBe(0.33);
    expect(defaultConfig.motion.swipeCommitVelocity).toBe(600);
  });
});
