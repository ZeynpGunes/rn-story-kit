import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StoryCardRing } from '../list/StoryCardRing';
import { StoryProvider } from '../provider/StoryProvider';

const wrap = ({ children }: { children: ReactNode }) => (
  <StoryProvider users={[]} scheme="light">
    {children}
  </StoryProvider>
);

type Json = { type: string; props: any; children?: Json[] | null };
const find = (type: string, pred: (n: Json) => boolean): Json | undefined => {
  const walk = (n: Json | Json[] | null): Json | undefined => {
    if (!n) return undefined;
    if (Array.isArray(n)) return n.map(walk).find(Boolean);
    if (n.type === type && pred(n)) return n;
    return walk(n.children ?? null);
  };
  return walk(screen.toJSON() as Json | Json[] | null);
};

describe('StoryCardRing', () => {
  const props = { seen: false, cover: 'https://x/c.jpg', ringId: 'kate' };

  it('is the card size plus ring width and gap on every side', async () => {
    await render(<StoryCardRing {...props} />, { wrapper: wrap });
    const svg = find('Svg', () => true)!;
    expect(svg.props.width).toBe(100 + 2 * (2.5 + 3));
    expect(svg.props.height).toBe(150 + 2 * (2.5 + 3));
  });

  it('draws rounded-rect gradient and seen strokes', async () => {
    await render(<StoryCardRing {...props} />, { wrapper: wrap });
    const active = screen.getByTestId('ring-active-kate');
    expect(active.props.rx).toBe(14 + 3 + 2.5 / 2);
    expect(active.props.stroke).toBe('url(#ring-kate)');
    expect(active.props.strokeWidth).toBe(2.5);
    const seen = screen.getByTestId('ring-seen-kate');
    expect(seen.props.strokeWidth).toBe(1.5);
    expect(
      find('LinearGradient', (n) => n.props.id === 'ring-kate')
    ).toBeTruthy();
  });

  it('uses ringColors for the gradient', async () => {
    await render(
      <StoryCardRing {...props} palette={['#111111', '#222222']} />,
      { wrapper: wrap }
    );
    const g = find('LinearGradient', (n) => n.props.id === 'ring-kate')!;
    expect((g.children ?? []).map((s) => s.props.stopColor)).toEqual([
      '#111111',
      '#222222',
    ]);
  });

  it('fills the card with a cover-fit image', async () => {
    await render(<StoryCardRing {...props} />, { wrapper: wrap });
    const img = find('View', (n) => n.props.source === 'https://x/c.jpg')!;
    expect(img.props.contentFit).toBe('cover');
    expect(img.props.style).toMatchObject({
      width: 100,
      height: 150,
      borderRadius: 14,
    });
  });

  it('omits the ring when showRing is false', async () => {
    await render(<StoryCardRing {...props} showRing={false} />, {
      wrapper: wrap,
    });
    expect(screen.queryByTestId('ring-active-kate')).toBeNull();
    expect(screen.queryByTestId('ring-seen-kate')).toBeNull();
  });
});
