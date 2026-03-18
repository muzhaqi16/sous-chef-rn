import { useState } from 'react';
import { useAppStore } from '#store/useAppStore';

/**
 * Returns `true` during the single render pass that detects a tutorial reset
 * (triggered by resetAllFeatureHints → bumpTutorialResetGeneration).
 *
 * Uses the "adjusting state during render" pattern — compiler-safe,
 * no refs, no effects.
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
