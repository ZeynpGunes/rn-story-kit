export const bubbleLabel = (name: string, seen: boolean, count: number) =>
  `${name}, ${seen ? 'seen' : 'new story'}, ${count} stories`;

export const closeLabel = 'Close stories';
export const nextStoryAction = 'Next story';
export const prevStoryAction = 'Previous story';

export const progressLabel = (index: number, count: number) =>
  `Story ${index} of ${count}`;

export const userAnnouncement = (
  name: string,
  storyNumber: number,
  count: number,
  time: string | null
) =>
  `${name}, story ${storyNumber} of ${count}${time === null ? '' : `, ${time}`}`;

export const viewCountLabel = (n: number) =>
  `${n} ${n === 1 ? 'view' : 'views'}`;
export const likeCountLabel = (n: number) =>
  `${n} ${n === 1 ? 'like' : 'likes'}`;
export const closeEngagementLabel = 'Close list';
export const likeActionLabel = (liked: boolean) =>
  liked ? 'Unlike story' : 'Like story';
export const voiceActionLabel = 'Voice message';
export const shareActionLabel = 'Share story';
export const sendMessageLabel = 'Send message';
export const followPersonLabel = (name: string) => `Follow ${name}`;
