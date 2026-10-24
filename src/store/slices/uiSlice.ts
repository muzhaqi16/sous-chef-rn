// ============================================
// Pure UI state management - no server data
// ============================================

import type { StateCreator } from 'zustand';
import type { RootState } from '../index';
import type { ImageFile } from '#/types/media';

/** An add another tab asked a tab to start when it next gains focus. */
export interface PendingTabAdd {
  /** The tab's route name, such as `Pantry`. */
  tab: string;
  /** The `+` action to run; absent, one action runs and several open the menu. */
  actionKey?: string;
}

export interface UIState {
  // Cross-navigation scroll flags
  pendingPantryScrollToTop: boolean;

  pendingTabAdd: PendingTabAdd | null;

  // Tutorial reset signal (session-only counter; bumped by resetAllFeatureHints)
  tutorialResetGeneration: number;

  // The crop screen's output, read once by whichever screen sent the user
  // there. Session-only: a cropped image nobody collected is not worth keeping
  // past a sign-out, and a persisted one would surface for the next account.
  pendingCroppedImage: ImageFile | null;

  // Images the item form selected, held until the create mutation returns an
  // id to attach them to. Session-only for the same reason as the crop hand-off.
  pendingItemImages: Array<ImageFile & { perspective?: string }> | null;

  // Actions
  setPendingPantryScrollToTop: (pending: boolean) => void;
  setPendingTabAdd: (pending: PendingTabAdd) => void;
  /** Drops the add once it ran, said why it cannot, or its tab was left. */
  clearPendingTabAdd: () => void;
  setPendingCroppedImage: (image: ImageFile | null) => void;
  /** Reads and clears in one step, so two screens cannot both collect it. */
  takePendingCroppedImage: () => ImageFile | null;
  setPendingItemImages: (
    images: Array<ImageFile & { perspective?: string }> | null,
  ) => void;
  bumpTutorialResetGeneration: () => void;
}

const initialUIState = {
  pendingPantryScrollToTop: false,
  pendingTabAdd: null,
  tutorialResetGeneration: 0,
  pendingCroppedImage: null,
  pendingItemImages: null,
};

export const createUISlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  UIState
> = (set, get) => ({
  ...initialUIState,

  setPendingPantryScrollToTop: pending => {
    set(state => {
      state.pendingPantryScrollToTop = pending;
    });
  },

  setPendingTabAdd: pending => {
    set(state => {
      state.pendingTabAdd = pending;
    });
  },

  clearPendingTabAdd: () => {
    set(state => {
      state.pendingTabAdd = null;
    });
  },

  setPendingCroppedImage: image => {
    set(state => {
      state.pendingCroppedImage = image;
    });
  },

  setPendingItemImages: images => {
    set(state => {
      state.pendingItemImages = images;
    });
  },

  takePendingCroppedImage: () => {
    const image = get().pendingCroppedImage;
    if (image) {
      set(state => {
        state.pendingCroppedImage = null;
      });
    }
    return image;
  },

  bumpTutorialResetGeneration: () => {
    set(state => {
      state.tutorialResetGeneration += 1;
    });
  },
});

/**
 * What a session end drops: the cross-screen hand-offs, which name a row or hold
 * an image the next account must not receive. `tutorialResetGeneration` is
 * deliberately absent — it is a bump counter, and resetting it reads to
 * {@link useTutorialResetSignal} as a reset somebody asked for.
 */
export const TRANSIENT_UI_STATE = {
  pendingPantryScrollToTop: false,
  pendingTabAdd: null,
  pendingCroppedImage: null,
  pendingItemImages: null,
} satisfies Partial<UIState>;
