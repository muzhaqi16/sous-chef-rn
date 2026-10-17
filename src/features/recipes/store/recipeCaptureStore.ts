import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { zustandStorage } from '#/storage/mmkv';
import { registerSessionScopedStore } from '#store/sessionScopedStores';

/** The server reads a capture as UNAVAILABLE past ten minutes; a minute's grace. */
export const CAPTURE_DEADLINE_MS = 11 * 60 * 1000;
/** The server purges a capture seven days on, taking its draft and candidates. */
const CAPTURE_HELD_MS = 7 * 24 * 60 * 60 * 1000;

export type CaptureSource = 'url' | 'text' | 'photo';

/**
 * A capture this device asked for: reading until its outcome is told, or read
 * only in part and waiting for the user to finish it in the editor.
 */
export interface CaptureEntry {
  id: string;
  source: CaptureSource;
  /** What its row says: the page's host, or the text's first words. */
  label: string | null;
  /** The page it read, or the post its text came from: the recipe's link. */
  link?: string;
  createdAt: string;
  state: 'reading' | 'incomplete';
  /** Its create has been answered; until then the server may not hold it yet. */
  answered: boolean;
}

/** A saved capture's recipe, kept while the capture can still be read for review. */
interface HeldCapture {
  captureId: string;
  recipeId: string;
  savedAt: string;
}

interface RecipeCaptureState {
  entries: CaptureEntry[];
  held: HeldCapture[];
  addReading: (entry: Omit<CaptureEntry, 'state' | 'answered'>) => void;
  markAnswered: (captureId: string) => void;
  markIncomplete: (captureId: string) => void;
  /** Its outcome is told; a saved one's recipe is held for review. */
  settle: (captureId: string, savedRecipeId?: string) => void;
  /** Drops entries past the server's deadline or purge. */
  prune: (now: number) => void;
  reset: () => void;
}

const PERSIST_KEY = 'sous-chef-recipe-captures';

const ageOf = (iso: string, now: number) => now - Date.parse(iso);

const isLive = (entry: CaptureEntry, now: number) =>
  ageOf(entry.createdAt, now) <
  (entry.state === 'reading' ? CAPTURE_DEADLINE_MS : CAPTURE_HELD_MS);

export const useRecipeCaptureStore = create<RecipeCaptureState>()(
  persist(
    set => ({
      entries: [],
      held: [],
      addReading: entry =>
        set(({ entries }) =>
          entries.some(existing => existing.id === entry.id)
            ? {}
            : {
                entries: [
                  ...entries,
                  { ...entry, state: 'reading', answered: false },
                ],
              },
        ),
      markAnswered: captureId =>
        set(({ entries }) => ({
          entries: entries.map(entry =>
            entry.id === captureId ? { ...entry, answered: true } : entry,
          ),
        })),
      markIncomplete: captureId =>
        set(({ entries }) => ({
          entries: entries.map(entry =>
            entry.id === captureId ? { ...entry, state: 'incomplete' } : entry,
          ),
        })),
      settle: (captureId, savedRecipeId) =>
        set(({ entries, held }) => ({
          entries: entries.filter(entry => entry.id !== captureId),
          held:
            savedRecipeId && !held.some(entry => entry.captureId === captureId)
              ? [
                  ...held,
                  {
                    captureId,
                    recipeId: savedRecipeId,
                    savedAt: new Date().toISOString(),
                  },
                ]
              : held,
        })),
      prune: now =>
        set(({ entries, held }) => ({
          entries: entries.filter(entry => isLive(entry, now)),
          held: held.filter(
            entry => ageOf(entry.savedAt, now) < CAPTURE_HELD_MS,
          ),
        })),
      reset: () => set({ entries: [], held: [] }),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => zustandStorage),
      version: 2,
      // Saved as answered: after a restart no send of it can still be in flight.
      partialize: ({ entries, held }) => ({
        entries: entries.map(entry => ({ ...entry, answered: true })),
        held,
      }),
    },
  ),
);

registerSessionScopedStore('recipeCaptures', () =>
  useRecipeCaptureStore.getState().reset(),
);

export const useCaptureEntries = () =>
  useRecipeCaptureStore(state => state.entries);

/** The link a capture this device asked for read; null when it had none. */
export const useCaptureLink = (captureId: string | undefined) =>
  useRecipeCaptureStore(
    state => state.entries.find(entry => entry.id === captureId)?.link ?? null,
  );

/** The capture a recipe came from, while it is still held. */
export const useHeldCaptureId = (recipeId: string | undefined) =>
  useRecipeCaptureStore(
    state =>
      state.held.find(entry => entry.recipeId === recipeId)?.captureId ?? null,
  );

/** The store's writes. Stable, so reading them never re-renders. */
export const useRecipeCaptureActions = () =>
  useRecipeCaptureStore(
    useShallow(
      ({ addReading, markAnswered, markIncomplete, settle, prune }) => ({
        addReading,
        markAnswered,
        markIncomplete,
        settle,
        prune,
      }),
    ),
  );
