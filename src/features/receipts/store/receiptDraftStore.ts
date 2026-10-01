import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandStorage } from '#/storage/mmkv';
import { registerSessionScopedStore } from '#store/sessionScopedStores';
import type { ParsedReceipt } from '../utils/structureReceipt';

/** What one receipt line becomes in the pantry. */
export interface ReceiptLineChoice {
  /** A catalog item picked from the suggestions; null adds the typed name. */
  itemId: string | null;
  itemName: string;
  quantity: number;
  unitId: string | null;
  /** The unit as typed, sent by name when none was picked. */
  unitText: string;
  /** The total paid for the line. */
  price: number | null;
  /** Added on its own, leaving the shopping list line it matches open. */
  offList?: boolean;
}

export interface ReceiptDraft {
  /** Each page's redacted text, in scan order; never an image. */
  pages: string[];
  scannedAt: string;
  /** The day printed on the receipt (YYYY-MM-DD), read before redaction cut it. */
  purchasedOn?: string;
  /** Structured on the phone, when its model could. */
  parsed?: ParsedReceipt;
  /** The review's picks by line index; a line without one is not added. */
  choices?: Partial<Record<number, ReceiptLineChoice>>;
  /** Lines already in the pantry, so a retry sends only what failed. */
  added?: number[];
}

interface ReceiptDraftState {
  draft: ReceiptDraft | null;
  saveDraft: (draft: ReceiptDraft) => void;
  chooseLine: (index: number, choice: ReceiptLineChoice | null) => void;
  markAdded: (indexes: readonly number[]) => void;
  clearDraft: () => void;
}

const PERSIST_KEY = 'sous-chef-receipt-draft';

/** The one receipt waiting to be matched; persisted so a scan made offline survives a restart. */
export const useReceiptDraftStore = create<ReceiptDraftState>()(
  persist(
    set => ({
      draft: null,
      saveDraft: draft => set({ draft }),
      chooseLine: (index, choice) =>
        set(({ draft }) => {
          if (!draft) return {};
          const { [index]: _previous, ...others } = draft.choices ?? {};
          return {
            draft: {
              ...draft,
              choices: choice ? { ...others, [index]: choice } : others,
            },
          };
        }),
      markAdded: indexes =>
        set(({ draft }) =>
          draft
            ? {
                draft: {
                  ...draft,
                  added: [...new Set([...(draft.added ?? []), ...indexes])],
                },
              }
            : {},
        ),
      clearDraft: () => set({ draft: null }),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => zustandStorage),
      version: 1,
      partialize: state => ({ draft: state.draft }),
    },
  ),
);

registerSessionScopedStore('receiptDraft', () =>
  useReceiptDraftStore.getState().clearDraft(),
);
