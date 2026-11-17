import { rgbaToThumbHash } from 'thumbhash';
import {
  clampLightness,
  hexToRgb,
  mix,
  rgbToHex,
  saturate,
} from '../color/colorMath';
import {
  averageColorFromThumbhash,
  base64ToBytes,
  mediaGradient,
} from '../color/thumbhash';

declare const Buffer: {
  from(b: Uint8Array): { toString(enc: 'base64'): string };
};

function solidThumbhash(): string {
  const rgba = new Uint8Array(8 * 8 * 4);
  for (let i = 0; i < 64; i++) {
    rgba.set([51, 102, 204, 255], i * 4);
  }
  return Buffer.from(rgbaToThumbHash(8, 8, rgba)).toString('base64');
}

function lightness(c: { r: number; g: number; b: number }): number {
  const max = Math.max(c.r, c.g, c.b) / 255;
  const min = Math.min(c.r, c.g, c.b) / 255;
  return (max + min) / 2;
}

describe('colorMath', () => {
  it('mixes', () => {
    expect(rgbToHex(mix(hexToRgb('#FFFFFF')!, hexToRgb('#000000')!, 0.5))).toBe(
      '#808080'
    );
    expect(
      rgbToHex(mix(hexToRgb('#FF0000')!, { r: 0, g: 0, b: 0 }, 0.25))
    ).toBe('#BF0000');
  });

  it('parses hex', () => {
    expect(hexToRgb('#abc')).toEqual({ r: 170, g: 187, b: 204 });
    expect(hexToRgb('#112233')).toEqual({ r: 17, g: 34, b: 51 });
    expect(hexToRgb('nope')).toBeNull();
  });

  it('clamps lightness', () => {
    const c = clampLightness(hexToRgb('#FFFFFF')!, 0.45);
    expect(lightness(c)).toBeLessThanOrEqual(0.45 + 0.005);
  });

  it('leaves dark colours alone when clamping', () => {
    const c = hexToRgb('#102030')!;
    expect(rgbToHex(clampLightness(c, 0.45))).toBe('#102030');
  });

  it('saturates', () => {
    const c = saturate({ r: 100, g: 120, b: 140 }, 2);
    expect(c.b - c.r).toBeGreaterThan(40);
    expect(rgbToHex(saturate({ r: 128, g: 128, b: 128 }, 1.1))).toBe('#808080');
  });
});

describe('thumbhash', () => {
  it('decodes base64', () => {
    expect(base64ToBytes('AQID')).toEqual(new Uint8Array([1, 2, 3]));
    expect(base64ToBytes('AQI=')).toEqual(new Uint8Array([1, 2]));
    expect(base64ToBytes('%%%')).toBeNull();
  });

  it('recovers average colour', () => {
    const c = averageColorFromThumbhash(solidThumbhash())!;
    expect(Math.abs(c.r - 51)).toBeLessThanOrEqual(8);
    expect(Math.abs(c.g - 102)).toBeLessThanOrEqual(8);
    expect(Math.abs(c.b - 204)).toBeLessThanOrEqual(8);
    expect(averageColorFromThumbhash('%%%')).toBeNull();
  });
});

describe('mediaGradient', () => {
  it('uses explicit colours', () => {
    expect(mediaGradient({ colors: ['#112233'] }, '#000000')).toEqual([
      '#112233',
    ]);
    expect(mediaGradient({ colors: ['bad', '#112233'] }, '#000000')).toEqual([
      '#112233',
    ]);
  });

  it('keeps at most 3 colours', () => {
    const colors = ['#111111', '#222222', '#333333', '#444444'];
    expect(mediaGradient({ colors }, '#000000')).toEqual(colors.slice(0, 3));
  });

  it('derives 3 stops from thumbhash', () => {
    const stops = mediaGradient({ thumbhash: solidThumbhash() }, '#000000');
    expect(stops).toHaveLength(3);
    const first = hexToRgb(stops[0]!)!;
    const black = { r: 0, g: 0, b: 0 };
    expect(stops[1]).toBe(rgbToHex(mix(first, black, 0.25)));
    expect(stops[2]).toBe(rgbToHex(mix(first, black, 0.55)));
  });

  it('falls back', () => {
    expect(mediaGradient({ thumbhash: '%%%' }, '#111214')).toEqual(['#111214']);
    expect(mediaGradient({ colors: ['bad'] }, '#111214')).toEqual(['#111214']);
    expect(mediaGradient({}, '#111214')).toEqual(['#111214']);
  });
});
