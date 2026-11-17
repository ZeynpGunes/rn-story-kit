import Svg, { Path } from 'react-native-svg';

export function HeartIcon({
  size,
  color,
  filled,
}: {
  size: number;
  color: string;
  filled: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 21s-7.2-4.35-9.6-8.4C.6 9.3 2.1 5.7 5.4 5.1c1.95-.35 3.75.6 4.8 2.1 1.05-1.5 2.85-2.45 4.8-2.1 3.3.6 4.8 4.2 3 7.5C19.2 16.65 12 21 12 21z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
