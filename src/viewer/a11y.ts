import { defaultStrings, fill, type StoryStrings } from '../strings';

const s = (partial?: StoryStrings | null): StoryStrings =>
  partial ? { ...defaultStrings, ...partial } : defaultStrings;

export const bubbleLabel = (
  strings: StoryStrings | null | undefined,
  name: string,
  seen: boolean,
  count: number
) => {
  const copy = s(strings);
  return fill(seen ? copy.bubbleSeen : copy.bubbleNew, { name, count });
};

export const suggestedBubbleLabel = (
  strings: StoryStrings | null | undefined,
  name: string,
  count: number
) => fill(s(strings).bubbleSuggested, { name, count });

export const progressLabel = (
  strings: StoryStrings | null | undefined,
  index: number,
  count: number
) => fill(s(strings).storyProgress, { index, count });

export const userAnnouncement = (
  strings: StoryStrings | null | undefined,
  name: string,
  storyNumber: number,
  count: number,
  time: string | null
) => {
  const copy = s(strings);
  return (
    fill(copy.announce, { name, number: storyNumber, count }) +
    (time === null ? '' : fill(copy.announceTime, { time }))
  );
};

export const viewCountLabel = (
  strings: StoryStrings | null | undefined,
  n: number
) => {
  const copy = s(strings);
  return fill(n === 1 ? copy.viewOne : copy.viewOther, { n });
};

export const likeCountLabel = (
  strings: StoryStrings | null | undefined,
  n: number
) => {
  const copy = s(strings);
  return fill(n === 1 ? copy.likeOne : copy.likeOther, { n });
};

export const followPersonLabel = (
  strings: StoryStrings | null | undefined,
  name: string
) => fill(s(strings).followPerson, { name });

export const likeActionLabel = (
  strings: StoryStrings | null | undefined,
  liked: boolean
) => {
  const copy = s(strings);
  return liked ? copy.unlikeStory : copy.likeStory;
};
