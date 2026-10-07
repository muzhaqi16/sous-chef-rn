import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { zustandStorage } from '#/storage/mmkv';
import { registerSessionScopedStore } from '#store/sessionScopedStores';
import { isRecord } from '#/utils/isRecord';
import type { ParsedReceipt } from '../utils/parsedReceipt';
import type { ReceiptTotalsGap } from '../utils/receiptTotalsGap';

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
export type ServerReceiptParse = {
  id: string;
  /** What was sent: the receipt's photos, or its text. */
  via: 'photos' | 'text';
} & (
  | {
      /** `tooLong`: refused for its size, which a resend would only repeat. */
      state: 'pending' | 'unavailable' | 'failed' | 'unreadable' | 'tooLong';
    }
  /** Over the daily allowance: asked again on a visit after `retryAt`. */
  | { state: 'limited'; retryAt: string }
);

/** The shop as the server's parse read it: what places or proposes a store. */
export interface PrintedStore {
  name: string;
  address?: string;
  storeNumber?: string;
}

/** What a finished server parse leaves on the draft: a state, or the receipt it read. */
export type ServerParseOutcome =
  | Exclude<ServerReceiptParse['state'], 'limited'>
  | {
      parsed: ParsedReceipt;
      purchasedOn?: string;
      totalsGap?: ReceiptTotalsGap;
      printedStore?: PrintedStore;
    };

export interface ReceiptDraft {
  /**
   * Each page's redacted text, in scan order: the fallback when the photos
   * cannot be read. Empty only when the phone could not read the pages.
   */
  pages: string[];
  /**
   * The upload keys of the receipt's photos, for the server to read. A photo
   * parse spends them, so one that ends without a reading drops them and the
   * text is sent instead. The server deletes the photos.
   */
  photoKeys?: string[];
  scannedAt: string;
  /**
   * The day of the shop (YYYY-MM-DD): read from the receipt before redaction
   * cut it, or set by the user in the review.
   */
  purchasedOn?: string;
  /** The store the user picked in the review, over the one the API resolved. */
  store?: { id: string; name: string };
  /** Structured on the phone, when its model could, else by the server. */
  parsed?: ParsedReceipt;
  /** Which of the two structured `parsed`. */
  parsedBy?: 'device' | 'server';
  /** The server found its reading does not add up to the receipt. */
  totalsGap?: ReceiptTotalsGap;
  printedStore?: PrintedStore;
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
  /** The day of the shop, as the user corrected it (YYYY-MM-DD). */
  setPurchasedOn: (day: string) => void;
  /** The store, as the user corrected it. */
  chooseStore: (store: { id: string; name: string }) => void;
  /**
   * The upload keys of the photos of the draft scanned at `scannedAt`, before
   * it is asked for. An upload that outlives its draft records nothing.
   */
  recordPhotoKeys: (scannedAt: string, keys: string[]) => void;
  /**
   * Records that server parse `id` was asked for, of the photos or the text, if
   * nothing read the draft yet, or asked again after the daily allowance
   * turned it away.
   */
  askServerParse: (id: string, via: ServerReceiptParse['via']) => void;
  /**
   * Records what became of server parse `id`, or when the daily allowance lets
   * it be asked again. Ignored once the draft has moved on.
   */
  settleServerParse: (
    id: string,
    outcome: ServerParseOutcome | { retryAt: string },
  ) => void;
  clearDraft: () => void;
}

const PERSIST_KEY = 'sous-chef-receipt-draft';

// v1 parses carry no `via`: a draft with photo keys sent them.
const migrateDraft = (persisted: unknown, version: number): unknown => {
  if (version >= 2 || !isRecord(persisted) || !isRecord(persisted.draft)) {
    return persisted;
  }
  const { draft } = persisted;
  if (!isRecord(draft.serverParse)) return persisted;
  const via = Array.isArray(draft.photoKeys) ? 'photos' : 'text';
  return {
    ...persisted,
    draft: { ...draft, serverParse: { ...draft.serverParse, via } },
  };
};

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
      setPurchasedOn: day =>
        set(({ draft }) =>
          draft ? { draft: { ...draft, purchasedOn: day } } : {},
        ),
      chooseStore: store =>
        set(({ draft }) => (draft ? { draft: { ...draft, store } } : {})),
      recordPhotoKeys: (scannedAt, keys) =>
        set(({ draft }) =>
          draft?.scannedAt === scannedAt && !draft.parsed && !draft.serverParse
            ? { draft: { ...draft, photoKeys: keys } }
            : {},
        ),
      askServerParse: (id, via) =>
        set(({ draft }) =>
          draft &&
          !draft.parsed &&
          (!draft.serverParse || draft.serverParse.state === 'limited')
            ? {
                draft: {
                  ...draft,
                  serverParse: { id, via, state: 'pending' },
                },
              }
            : {},
        ),
      settleServerParse: (id, outcome) =>
        set(({ draft }) => {
          if (draft?.serverParse?.id !== id) return {};
          const { via } = draft.serverParse;
          // The photos are spent: a receipt with text is read from it instead.
          const { photoKeys: _spent, ...withoutPhotos } = draft;
          const fallsBackToText = via === 'photos' && draft.pages.length > 0;
          if (typeof outcome === 'string') {
            if (fallsBackToText) {
              const { serverParse: _photoParse, ...rest } = withoutPhotos;
              return { draft: rest };
            }
            return {
              draft: { ...draft, serverParse: { id, via, state: outcome } },
            };
          }
          if ('retryAt' in outcome) {
            const { retryAt } = outcome;
            return {
              draft: {
                ...(fallsBackToText ? withoutPhotos : draft),
                serverParse: { id, via, state: 'limited', retryAt },
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
              ...(outcome.totalsGap ? { totalsGap: outcome.totalsGap } : {}),
              ...(outcome.printedStore
                ? { printedStore: outcome.printedStore }
                : {}),
            },
          };
        }),
      clearDraft: () => set({ draft: null }),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => zustandStorage),
      version: 2,
      partialize: state => ({ draft: state.draft }),
      migrate: migrateDraft,
    },
  ),
);

registerSessionScopedStore('receiptDraft', () =>
  useReceiptDraftStore.getState().clearDraft(),
);

export const useReceiptDraft = () => useReceiptDraftStore(state => state.draft);

/** The draft's writes. Stable, so reading them never re-renders. */
export const useReceiptDraftActions = () =>
  useReceiptDraftStore(useShallow(({ draft: _draft, ...actions }) => actions));
