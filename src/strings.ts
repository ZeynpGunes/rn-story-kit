/** Replace `{name}`-style tokens in a template. */
export function fill(
  template: string | undefined,
  vars: Record<string, string | number>
): string {
  if (typeof template !== 'string') return '';
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] === undefined ? '' : String(vars[key])
  );
}

/** All user-facing copy. Override via `config.strings` for i18n. */
export interface StoryStrings {
  replyPlaceholder: string;
  follow: string;
  /** e.g. `Follow {name}` */
  followPerson: string;
  viewersTitle: string;
  likesTitle: string;
  noViewers: string;
  noLikes: string;
  closeList: string;
  closeStories: string;
  likeStory: string;
  unlikeStory: string;
  voiceMessage: string;
  shareStory: string;
  sendMessage: string;
  liked: string;
  /** e.g. `{n} view` */
  viewOne: string;
  /** e.g. `{n} views` */
  viewOther: string;
  likeOne: string;
  likeOther: string;
  /** e.g. `Story {index} of {count}` */
  storyProgress: string;
  nextStory: string;
  prevStory: string;
  /** e.g. `{name}, new story, {count} stories` */
  bubbleNew: string;
  /** e.g. `{name}, seen, {count} stories` */
  bubbleSeen: string;
  /** e.g. `{name}, story {number} of {count}` */
  announce: string;
  /** Appended when time is present, e.g. `, {time}` */
  announceTime: string;
}

export const defaultStrings: StoryStrings = {
  replyPlaceholder: 'Send message...',
  follow: 'Follow',
  followPerson: 'Follow {name}',
  viewersTitle: 'Viewers',
  likesTitle: 'Likes',
  noViewers: 'No viewers yet',
  noLikes: 'No likes yet',
  closeList: 'Close list',
  closeStories: 'Close stories',
  likeStory: 'Like story',
  unlikeStory: 'Unlike story',
  voiceMessage: 'Voice message',
  shareStory: 'Share story',
  sendMessage: 'Send message',
  liked: 'Liked',
  viewOne: '{n} view',
  viewOther: '{n} views',
  likeOne: '{n} like',
  likeOther: '{n} likes',
  storyProgress: 'Story {index} of {count}',
  nextStory: 'Next story',
  prevStory: 'Previous story',
  bubbleNew: '{name}, new story, {count} stories',
  bubbleSeen: '{name}, seen, {count} stories',
  announce: '{name}, story {number} of {count}',
  announceTime: ', {time}',
};
