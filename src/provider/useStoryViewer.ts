import { useStoryContext, type StoryViewerApi } from './StoryProvider';

export function useStoryViewer(): StoryViewerApi {
  return useStoryContext().api;
}
