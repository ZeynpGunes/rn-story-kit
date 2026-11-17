import type { PaletteName } from '../types';

const same = (stops: string[]) => ({ light: stops, dark: stops });

export const palettes: Record<
  PaletteName,
  { light: string[]; dark: string[] }
> = {
  classic: same(['#FFC247', '#FF8A3D', '#F2475F', '#C73CA8', '#FFC247']),
  ocean: same(['#2DE2E6', '#2F8CFF', '#5B5BFF', '#2F8CFF', '#2DE2E6']),
  sunset: same(['#FFD36B', '#FF7A59', '#E8456B', '#7A3FD1', '#FFD36B']),
  mono: {
    light: ['#2B2D31', '#8A8D94', '#2B2D31'],
    dark: ['#FFFFFF', '#8E9097', '#FFFFFF'],
  },
  closeFriends: same(['#3DDC84', '#12B76A', '#7AE582', '#12B76A', '#3DDC84']),
};
