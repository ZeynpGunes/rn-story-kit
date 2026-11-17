import type { ComponentProps } from 'react';
import { View } from 'react-native';

export function Image(props: ComponentProps<typeof View>) {
  return <View {...props} />;
}
Image.prefetch = jest.fn(() => Promise.resolve(true));
