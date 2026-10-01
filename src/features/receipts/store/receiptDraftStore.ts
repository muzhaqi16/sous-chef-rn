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

/**
 * The server's reading of a receipt the phone could not structure. `id` is
 * minted before it is asked for, so a resend returns the same parse.
 */
export type ServerReceiptParse =
  | { id: string; state: 'pending' | 'unavailable' | 'failed' | 'unreadable' }
  /** Over the daily allowance: asked again on a visit after `retryAt`. */
  | { id: string; state: 'limited'; retryAt: string };

export interface ReceiptDraft {
  /** Each page's redacted text, in scan order; never an image. */
  pages: string[];
  scannedAt: string;
  /** The day printed on the receipt (YYYY-MM-DD), read before redaction cut it. */
  purchasedOn?: string;
  /** Structured on the phone, when its model could, else by the server. */
  parsed?: ParsedReceipt;
  /** Which of the two structured `parsed`. */
  parsedBy?: 'device' | 'server';
  serverParse?: ServerReceiptParse;
  /**
   * The review's picks by line index. Null keeps a line out even when the API
   * proposes an item for it; a line with neither is not added.
   */
  choices?: Partial<Record<number, ReceiptLineChoice | null>>;
  /** Lines already in the pantry, so a retry sends only what failed. */
  added?: number[];
}

interface ReceiptDraftState {
  draft: ReceiptDraft | null;
  saveDraft: (draft: ReceiptDraft) => void;
  /** A choice, or null to leave the line out. */
  chooseLine: (index: number, choice: ReceiptLineChoice | null) => void;
  markAdded: (indexes: readonly number[]) => void;
  /**
   * Records that server parse `id` was asked for, if nothing read the draft
   * yet, or asked again after the daily allowance turned it away.
   */
  askServerParse: (id: string) => void;
  /**
   * Records what became of server parse `id`: a state, the receipt it read,
   * when the daily allowance lets it be asked again, or null to ask again
   * later. Ignored once the draft has moved on.
   */
  settleServerParse: (
    id: string,
    outcome:
      | Exclude<ServerReceiptParse['state'], 'limited'>
      | { retryAt: string }
      | { parsed: ParsedReceipt; purchasedOn?: string }
      | null,
  ) => void;
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
        set(({ draft }) =>
          draft
            ? {
                draft: {
                  ...draft,
                  choices: { ...draft.choices, [index]: choice },
                },
              }
            : {},
        ),
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
      askServerParse: id =>
        set(({ draft }) =>
          draft &&
          !draft.parsed &&
          (!draft.serverParse || draft.serverParse.state === 'limited')
            ? { draft: { ...draft, serverParse: { id, state: 'pending' } } }
            : {},
        ),
      settleServerParse: (id, outcome) =>
        set(({ draft }) => {
          if (draft?.serverParse?.id !== id) return {};
          if (outcome === null) {
            const { serverParse: _asked, ...rest } = draft;
            return { draft: rest };
          }
          if (typeof outcome === 'string') {
            return { draft: { ...draft, serverParse: { id, state: outcome } } };
          }
          if ('retryAt' in outcome) {
            const { retryAt } = outcome;
            return {
              draft: {
                ...draft,
                serverParse: { id, state: 'limited', retryAt },
              },
            };
          }
          const { serverParse: _asked, ...rest } = draft;
          // The day read on the phone, before redaction, stands.
          const purchasedOn = draft.purchasedOn ?? outcome.purchasedOn;
          return {
            draft: {
              ...rest,
              parsed: outcome.parsed,
              parsedBy: 'server',
              ...(purchasedOn ? { purchasedOn } : {}),
            },
          };
        }),
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
