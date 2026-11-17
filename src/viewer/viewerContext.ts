import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

export interface ViewerControls {
  requestClose(): void;
  isClosing: SharedValue<boolean>;
  /** True during a user change; taps and new pans are ignored. */
  isTransitioning: SharedValue<boolean>;
}

export const ViewerContext = createContext<ViewerControls | null>(null);

/** Internal: viewer controls for its pages, header and gestures. */
export function useViewerControls(): ViewerControls {
  const ctx = useContext(ViewerContext);
  if (!ctx) throw new Error('rn-story-kit: useViewerControls outside viewer');
  return ctx;
}
