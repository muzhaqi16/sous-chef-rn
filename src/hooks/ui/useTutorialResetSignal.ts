import { useState } from 'react';
import { useAppStore } from '#store/useAppStore';

/**
 * `true` for the single render that detects a tutorial reset
 * (`resetAllFeatureHints` → `bumpTutorialResetGeneration`), via the
 * adjusting-state-during-render pattern — no refs, no effects.
 */
export function useTutorialResetSignal(): boolean {
  const gen = useAppStore(state => state.tutorialResetGeneration);
  const [prev, setPrev] = useState(gen);
  if (gen !== prev) {
    setPrev(gen);
    return true;
  }
  return false;
}
