// ============================================
// Per-user tutorial progress: which hints have been shown, and how many
// times each account has signed in (post-login modals space themselves out
// with it). Keyed by user so a shared device keeps the two apart.
// ============================================

import { StateCreator } from 'zustand';
import type { RootState } from '../index';

export interface TutorialState {
  /** `<userId|anonymous>:<featureId>` → shown. */
  featureHintsShown: Record<string, boolean>;
  loginCounts: Record<string, number>;

  markFeatureHintShown: (key: string) => void;
  clearFeatureHint: (key: string) => void;
  /** Every hint, for every account on this device. */
  clearAllFeatureHints: () => void;
  incrementLoginCount: (userId: string) => void;
}

export const initialTutorialState = {
  featureHintsShown: {},
  loginCounts: {},
};

export const createTutorialSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  TutorialState
> = set => ({
  ...initialTutorialState,

  markFeatureHintShown: key => {
    set(state => {
      state.featureHintsShown[key] = true;
    });
  },

  clearFeatureHint: key => {
    set(state => {
      delete state.featureHintsShown[key];
    });
  },

  clearAllFeatureHints: () => {
    set(state => {
      state.featureHintsShown = {};
    });
  },

  incrementLoginCount: userId => {
    set(state => {
      state.loginCounts[userId] = (state.loginCounts[userId] ?? 0) + 1;
    });
  },
});
