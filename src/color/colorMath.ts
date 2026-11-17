/* eslint-disable no-bitwise */
export type RGB = { r: number; g: number; b: number };

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export function hexToRgb(hex: string): RGB | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) {
    h = h
      .split('')
      .map((ch) => ch + ch)
      .join('');
  }
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(c: RGB): string {
  const part = (v: number) =>
    Math.round(clamp(v, 0, 255))
      .toString(16)
      .padStart(2, '0');
  return `#${part(c.r)}${part(c.g)}${part(c.b)}`.toUpperCase();
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

type HSL = { h: number; s: number; l: number };

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const sector = Math.floor(h / 60) % 6;
  const [r, g, b] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][sector]!;
  return { r: (r! + m) * 255, g: (g! + m) * 255, b: (b! + m) * 255 };
}

export function saturate(c: RGB, factor: number): RGB {
  const hsl = rgbToHsl(c);
  return hslToRgb({ ...hsl, s: clamp(hsl.s * factor, 0, 1) });
}

export function clampLightness(c: RGB, maxL: number): RGB {
  const hsl = rgbToHsl(c);
  if (hsl.l <= maxL) return c;
  return hslToRgb({ ...hsl, l: maxL });
}
