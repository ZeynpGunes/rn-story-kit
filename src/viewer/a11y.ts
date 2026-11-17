export const bubbleLabel = (name: string, seen: boolean, count: number) =>
  `${name}, ${seen ? 'seen' : 'new story'}, ${count} stories`;

export const closeLabel = 'Close stories';
export const nextStoryAction = 'Next story';
export const prevStoryAction = 'Previous story';

export const progressLabel = (index: number, count: number) =>
  `Story ${index} of ${count}`;

export const userAnnouncement = (name: string, count: number, time: string) =>
  `${name}, story 1 of ${count}, ${time} ago`;
