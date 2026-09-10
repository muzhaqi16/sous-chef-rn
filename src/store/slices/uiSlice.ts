// ============================================
// Pure UI state management - no server data
// ============================================

import { StateCreator } from 'zustand';
import type { RootState } from '../index';
import type { ImageFile } from '#/types/media';

export interface UIState {
  // Cross-navigation scroll flags
  pendingPantryScrollToTop: boolean;

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
  pendingCroppedImage: null,
  pendingItemImages: null,
} satisfies Partial<UIState>;
