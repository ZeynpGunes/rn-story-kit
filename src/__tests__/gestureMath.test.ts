import { defaultConfig } from '../config';
import {
  cubeTransform,
  dismissProgress,
  dismissStyle,
  lerpRect,
  rubberBand,
  shouldDismiss,
  shouldSwipeUp,
  swipeDecision,
} from '../model/gestureMath';

const m = defaultConfig.motion;

describe('rubberBand', () => {
  it('damps symmetrically', () => {
    expect(rubberBand(400, 400)).toBeCloseTo(70);
    expect(rubberBand(-400, 400)).toBeCloseTo(-70);
  });
});

describe('swipeDecision', () => {
  it('commits on distance', () => {
    expect(swipeDecision(-140, 0, 400, m)).toBe(1);
    expect(swipeDecision(-100, 0, 400, m)).toBe(0);
    expect(swipeDecision(140, 0, 400, m)).toBe(-1);
  });
  it('commits on velocity only when sign matches dx', () => {
    expect(swipeDecision(-20, -700, 400, m)).toBe(1);
    expect(swipeDecision(-20, 700, 400, m)).toBe(0);
  });
});

describe('dismiss', () => {
  it('progress clamps', () => {
    expect(dismissProgress(240, 800)).toBeCloseTo(0.5);
    expect(dismissProgress(-50, 800)).toBe(0);
    expect(dismissProgress(5000, 800)).toBe(1);
  });
  it('shouldDismiss', () => {
    expect(shouldDismiss(121, 0, m)).toBe(true);
    expect(shouldDismiss(50, 801, m)).toBe(true);
    expect(shouldDismiss(50, 0, m)).toBe(false);
  });
  it('dismissStyle', () => {
    expect(dismissStyle(1)).toEqual({
      scale: 0.75,
      borderRadius: 40,
      bgOpacity: 0,
      uiOpacity: 0,
    });
    expect(dismissStyle(0.2).uiOpacity).toBeCloseTo(0.4);
  });
});

describe('shouldSwipeUp', () => {
  it('commits on distance or velocity', () => {
    expect(shouldSwipeUp(-81, 0, m)).toBe(true);
    expect(shouldSwipeUp(-10, -701, m)).toBe(true);
    expect(shouldSwipeUp(-10, -100, m)).toBe(false);
  });
});

describe('cubeTransform', () => {
  it('shade and perspective', () => {
    const a = cubeTransform(0, 400, 'incoming', 1000);
    expect(a.shadeOpacity).toBeCloseTo(0.5);
    expect(a.transform[0]).toEqual({ perspective: 1000 });
    expect(cubeTransform(1, 400, 'incoming', 1000).shadeOpacity).toBeCloseTo(0);
  });
  it('pivots at shared edge with mirrored rotation', () => {
    // finger left (p < 0): outgoing pivots on its right edge
    const out = cubeTransform(-0.5, 400, 'outgoing', 1000).transform;
    expect(out).toEqual([
      { perspective: 1000 },
      { translateX: 200 },
      { rotateY: '-45deg' },
      { translateX: -200 },
    ]);
    const inc = cubeTransform(-0.5, 400, 'incoming', 1000).transform;
    expect(inc).toEqual([
      { perspective: 1000 },
      { translateX: -200 },
      { rotateY: '45deg' },
      { translateX: 200 },
    ]);
  });
});

describe('lerpRect', () => {
  it('interpolates', () => {
    expect(
      lerpRect(
        { x: 0, y: 0, width: 64, height: 64 },
        { x: 0, y: 0, width: 400, height: 800 },
        0.5
      )
    ).toEqual({ x: 0, y: 0, width: 232, height: 432 });
  });
});
