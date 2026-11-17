import { defaultConfig, type StoryConfig } from '../config';
import type { Rect } from '../types';

type Motion = StoryConfig['motion'];

const clamp = (v: number, lo: number, hi: number) => {
  'worklet';
  return Math.min(hi, Math.max(lo, v));
};

/** Edge resistance: offset = dx * factor / (1 + |dx| / width). */
export function rubberBand(
  dx: number,
  width: number,
  factor: number = defaultConfig.motion.rubberBandFactor
): number {
  'worklet';
  return (dx * factor) / (1 + Math.abs(dx) / width);
}

/** 1 = next user (finger moved left), -1 = previous user, 0 = snap back. */
export function swipeDecision(
  dx: number,
  vx: number,
  width: number,
  m: Motion = defaultConfig.motion
): 1 | -1 | 0 {
  'worklet';
  if (dx === 0) return 0;
  const dir = dx < 0 ? 1 : -1;
  const byDistance = Math.abs(dx) > m.swipeCommitDistanceRatio * width;
  const byVelocity =
    Math.abs(vx) > m.swipeCommitVelocity && Math.sign(vx) === Math.sign(dx);
  return byDistance || byVelocity ? dir : 0;
}

export function dismissProgress(
  dy: number,
  height: number,
  m: Motion = defaultConfig.motion
): number {
  'worklet';
  return clamp(dy / (m.dismissDistanceRatio * height), 0, 1);
}

export function shouldDismiss(
  dy: number,
  vy: number,
  m: Motion = defaultConfig.motion
): boolean {
  'worklet';
  return dy > m.dismissCommitDistance || vy > m.dismissCommitVelocity;
}

export function shouldSwipeUp(
  dy: number,
  vy: number,
  m: Motion = defaultConfig.motion
): boolean {
  'worklet';
  return dy < -m.swipeUpCommitDistance || vy < -m.swipeUpCommitVelocity;
}

/**
 * Cube face transform. `p` is the signed drag fraction dx / width
 * (negative = finger left = next user). Each face pivots on the edge it
 * shares with the other face; incoming sits one 90deg step behind outgoing.
 * Layout offset of the incoming page is the caller's concern.
 */
export function cubeTransform(
  p: number,
  width: number,
  side: 'outgoing' | 'incoming',
  perspective: number,
  m: Motion = defaultConfig.motion
): { transform: object[]; shadeOpacity: number } {
  'worklet';
  const q = clamp(p, -1, 1);
  const s = q < 0 ? -1 : 1;
  const maxAngle = m.cubeMaxAngleDeg;
  const outgoing = side === 'outgoing';
  const edge = (outgoing ? -s : s) * (width / 2);
  const angle = outgoing ? q * maxAngle : (q - s) * maxAngle;
  return {
    transform: [
      { perspective },
      { translateX: edge },
      { rotateY: `${angle}deg` },
      { translateX: -edge },
    ],
    shadeOpacity: outgoing ? 0 : m.cubeShadeMaxOpacity * (1 - Math.abs(q)),
  };
}

export function dismissStyle(
  p: number,
  m: Motion = defaultConfig.motion
): {
  scale: number;
  borderRadius: number;
  bgOpacity: number;
  uiOpacity: number;
} {
  'worklet';
  return {
    scale: Math.max(m.dismissMinScale, 1 - m.dismissScaleFactor * p),
    borderRadius: m.dismissMaxRadius * p,
    bgOpacity: 1 - p,
    uiOpacity: 1 - Math.min(p * m.dismissUiFadeFactor, 1),
  };
}

export function lerpRect(a: Rect, b: Rect, t: number): Rect {
  'worklet';
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    width: a.width + (b.width - a.width) * t,
    height: a.height + (b.height - a.height) * t,
  };
}
