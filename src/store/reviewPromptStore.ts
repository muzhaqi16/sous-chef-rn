import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandStorage } from '#/store/deviceStorage';
import { hydrateWhenStarted } from '#store/persistedStores';
import { todayKey } from '#/utils/dateUtils';

/** Enough distinct days to tell a returning user from a first visit. */
const DAYS_KEPT = 3;

/**
 * How this DEVICE has been asked for a rating. Kept across a session end on
 * purpose: it names no account, and the OS's own quota is per device too.
 */
export interface ReviewPromptState {
  /** The last few distinct local days the app was opened, oldest first. */
  activeDays: string[];
  lastRequestedAt: number | null;
  lastRequestedVersion: string | null;
  recordActiveDay: (day: string) => void;
  recordRequest: (at: number, version: string) => void;
}

export const useReviewPromptStore = create<ReviewPromptState>()(
  persist(
    set => ({
      activeDays: [],
      lastRequestedAt: null,
      lastRequestedVersion: null,
      recordActiveDay: day =>
        set(state =>
          state.activeDays.includes(day)
            ? state
            : { activeDays: [...state.activeDays, day].slice(-DAYS_KEPT) },
        ),
      recordRequest: (at, version) =>
        set({ lastRequestedAt: at, lastRequestedVersion: version }),
    }),
    {
      name: 'sous-chef-review-prompt',
      storage: createJSONStorage(() => zustandStorage),
      skipHydration: true,
      version: 1,
      partialize: state => ({
        activeDays: state.activeDays,
        lastRequestedAt: state.lastRequestedAt,
        lastRequestedVersion: state.lastRequestedVersion,
      }),
      // Recorded once the stored days are in, or they would overwrite today.
      onRehydrateStorage: () => state => state?.recordActiveDay(todayKey()),
    },
  ),
);

hydrateWhenStarted(useReviewPromptStore);
