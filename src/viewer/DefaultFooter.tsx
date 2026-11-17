import type { StoryActionsConfig } from '../config';
import type { StoryItem, StoryPerson, StoryUser } from '../types';
import { ActionsBar } from './ActionsBar';
import { OwnerInsightsBar } from './OwnerInsightsBar';

export interface DefaultFooterProps {
  user: StoryUser;
  story: StoryItem;
  actions: StoryActionsConfig;
  replyPlaceholder: string;
  pause(): void;
  resume(): void;
  onLike?(story: StoryItem, user: StoryUser, nextLiked: boolean): void;
  onSendMessage?(story: StoryItem, user: StoryUser, text: string): void;
  onVoice?(story: StoryItem, user: StoryUser): void;
  onShare?(story: StoryItem, user: StoryUser): void;
  onFollow?(person: StoryPerson): void;
}

/** Built-in footer: owner insights or the others' action bar. */
export function DefaultFooter({
  user,
  story,
  actions,
  replyPlaceholder,
  pause,
  resume,
  onLike,
  onSendMessage,
  onVoice,
  onShare,
  onFollow,
}: DefaultFooterProps) {
  if (user.isOwner) {
    return (
      <OwnerInsightsBar
        story={story}
        pause={pause}
        resume={resume}
        onFollow={onFollow}
      />
    );
  }
  return (
    <ActionsBar
      user={user}
      story={story}
      actions={actions}
      replyPlaceholder={replyPlaceholder}
      pause={pause}
      resume={resume}
      onLike={onLike}
      onSendMessage={onSendMessage}
      onVoice={onVoice}
      onShare={onShare}
    />
  );
}

/** Whether the default footer would show anything for this config / users. */
export function shouldShowDefaultFooter(
  users: StoryUser[],
  actions: StoryActionsConfig
): boolean {
  if (users.some((u) => u.isOwner)) return true;
  return actions.message || actions.like || actions.voice || actions.share;
}
