/* eslint-disable no-bitwise */
import { thumbHashToAverageRGBA } from 'thumbhash';
import {
  clampLightness,
  hexToRgb,
  mix,
  rgbToHex,
  saturate,
  type RGB,
} from './colorMath';

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Own base64 decoder (no atob/Buffer on Hermes). Null if invalid. */
export function base64ToBytes(b64: string): Uint8Array | null {
  const s = b64.replace(/[=]+$/, '');
  if (s.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let acc = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ALPHABET.indexOf(s[i]!);
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 255;
      acc &= (1 << bits) - 1;
    }
  }
  return out;
}

export function averageColorFromThumbhash(b64: string): RGB | null {
  const bytes = base64ToBytes(b64);
  if (!bytes || bytes.length < 5) return null;
  const { r, g, b } = thumbHashToAverageRGBA(bytes);
  return { r: r * 255, g: g * 255, b: b * 255 };
}

const BLACK: RGB = { r: 0, g: 0, b: 0 };

/** 1-3 hex stops, top to bottom. */
export function mediaGradient(
  input: { colors?: string[]; thumbhash?: string },
  fallback: string
): string[] {
  const explicit = (input.colors ?? [])
    .map((c) => hexToRgb(c))
    .filter((c): c is RGB => c !== null)
    .map(rgbToHex)
    .slice(0, 3);
  if (explicit.length > 0) return explicit;

  const avg = input.thumbhash
    ? averageColorFromThumbhash(input.thumbhash)
    : null;
  if (!avg) return [fallback];

  const top = clampLightness(saturate(avg, 1.1), 0.45);
  const topHex = rgbToHex(top);
  // Derive from the rounded top stop so the stops are consistent with it.
  const base = hexToRgb(topHex)!;
  return [
    topHex,
    rgbToHex(mix(base, BLACK, 0.25)),
    rgbToHex(mix(base, BLACK, 0.55)),
  ];
}
