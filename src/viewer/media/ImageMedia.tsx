import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import type { StoryItem } from '../../types';

export interface ImageMediaProps {
  story: StoryItem;
  transitionMs: number;
  onDisplay(): void;
  onError(): void;
}

/** Story photo; thumbhash (or thumbnail) shows until the image decodes. */
export function ImageMedia({
  story,
  transitionMs,
  onDisplay,
  onError,
}: ImageMediaProps) {
  const placeholder = story.thumbhash
    ? { thumbhash: story.thumbhash }
    : story.thumbnail
      ? { uri: story.thumbnail }
      : undefined;
  return (
    <Image
      testID="story-image"
      source={{ uri: story.uri }}
      placeholder={placeholder}
      transition={transitionMs}
      contentFit="contain"
      accessibilityLabel={story.alt}
      onDisplay={onDisplay}
      onError={onError}
      style={StyleSheet.absoluteFill}
    />
  );
}
