import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { zustandStorage } from '#/storage/mmkv';
import { registerSessionScopedStore } from '#store/sessionScopedStores';
import { isRecord } from '#/utils/isRecord';
import { generateEntityId } from '#/utils/generateEntityId';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import type { ParsedReceipt, ReceiptTotalsGap } from '../utils/parsedReceipt';

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
  /** Recorded as bought without adding it to the pantry. */
  notStocked?: boolean;
}

/**
 * The server's reading of a receipt the phone did not structure, from its
 * photos while they are unspent, else its text. `id` is minted before it is
 * asked for, so a resend returns the same parse.
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

/** One line's outcome, as a check-in answers it. */
export interface CheckInLineOutcome {
  index: number;
  success: boolean;
  failure?: { code: string } | null;
}

const ERROR_CODES: ReadonlySet<string> = new Set(Object.values(ErrorCode));
const isErrorCode = (code: string): code is ErrorCode => ERROR_CODES.has(code);

/** A line's ids on the check-in, minted the first time it is confirmed. */
export interface CheckInLineIds {
  purchaseId: string;
  pantryItemId: string;
  /** The catalog item a typed product name creates, or is matched under. */
  newItemId: string;
}

/**
 * The receipt as sent to the API. Its ids are minted once and kept across
 * retries, restarts and the offline queue, so the API records nothing twice.
 */
export interface ReceiptCheckIn {
  /** One per check-in sent: the API takes at most 100 lines in one. */
  ids: string[];
  lines: Partial<Record<number, CheckInLineIds>>;
  state: 'idle' | 'sending' | 'queued';
  /** The review closed while it was sending or queued: cleared once it lands. */
  closed?: boolean;
}

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
  /** Every photo had the personal details the phone read painted over. */
  photosMasked?: boolean;
  scannedAt: string;
  /**
   * The day of the shop (YYYY-MM-DD): read from the receipt before redaction
   * cut it, or set by the user in the review.
   */
  purchasedOn?: string;
  /** The store the user picked in the review, over the one the API resolved. */
  store?: { id: string; name: string };
  /** Read on the phone, by the rules or its model, else by the server. */
  parsed?: ParsedReceipt;
  /** The server parse that read it: the check-in completes its store from it. */
  parseId?: string;
  /** Which of the two structured `parsed`. */
  parsedBy?: 'device' | 'server';
  /** Whoever read it found its lines do not add up to the receipt. */
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
  checkIn?: ReceiptCheckIn;
  /** Why each line the API refused failed, by line index. */
  failed?: Partial<Record<number, ErrorCode>>;
}

interface ReceiptDraftState {
  draft: ReceiptDraft | null;
  saveDraft: (draft: ReceiptDraft) => void;
  /** A choice, or null to leave the line out. */
  chooseLine: (index: number, choice: ReceiptLineChoice | null) => void;
  markAdded: (indexes: readonly number[]) => void;
  /**
   * Mints the ids these lines and `sends` check-ins need, keeping every id
   * already minted.
   */
  ensureCheckInIds: (indexes: readonly number[], sends: number) => void;
  setCheckInState: (state: ReceiptCheckIn['state']) => void;
  /**
   * What the API made of check-in `checkInId`'s lines: those it recorded are
   * added, the rest failed with their codes. Ignored once the draft has moved on.
   */
  settleCheckIn: (
    checkInId: string,
    results: readonly CheckInLineOutcome[],
  ) => void;
  /**
   * Replaces a check-in id another user holds. Its lines keep their purchase
   * ids, which are what a resend is recognised by.
   */
  remintCheckInId: (id: string) => string;
  /**
   * The review is done with the receipt. One still sending or queued is kept
   * until it lands, and one with a refused line for its retry; else it goes.
   */
  closeReceipt: () => void;
  /** The day of the shop, as the user corrected it (YYYY-MM-DD). */
  setPurchasedOn: (day: string) => void;
  /** The store, as the user corrected it. */
  chooseStore: (store: { id: string; name: string }) => void;
  /**
   * The upload keys of the photos of the draft scanned at `scannedAt`, before
   * it is asked for, and whether every one was masked. An upload that outlives
   * its draft records nothing.
   */
  recordPhotoKeys: (scannedAt: string, keys: string[], masked: boolean) => void;
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

const withCheckInIds = (
  checkIn: ReceiptCheckIn | undefined,
  indexes: readonly number[],
  sends: number,
): ReceiptCheckIn => {
  const ids = [...(checkIn?.ids ?? [])];
  while (ids.length < sends) ids.push(generateEntityId());
  const lines = { ...checkIn?.lines };
  for (const index of indexes) {
    lines[index] ??= {
      purchaseId: generateEntityId(),
      pantryItemId: generateEntityId(),
      newItemId: generateEntityId(),
    };
  }
  return { ids, lines, state: checkIn?.state ?? 'idle' };
};

const withoutIndexes = <Value>(
  byIndex: Partial<Record<number, Value>> | undefined,
  indexes: readonly number[],
) =>
  Object.fromEntries(
    Object.entries(byIndex ?? {}).filter(
      ([index]) => !indexes.includes(Number(index)),
    ),
  );

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
                  failed: withoutIndexes(draft.failed, indexes),
                },
              }
            : {},
        ),
      ensureCheckInIds: (indexes, sends) =>
        set(({ draft }) =>
          draft
            ? {
                draft: {
                  ...draft,
                  checkIn: withCheckInIds(draft.checkIn, indexes, sends),
                },
              }
            : {},
        ),
      setCheckInState: state =>
        set(({ draft }) =>
          draft?.checkIn
            ? { draft: { ...draft, checkIn: { ...draft.checkIn, state } } }
            : {},
        ),
      settleCheckIn: (checkInId, results) =>
        set(({ draft }) => {
          if (!draft?.checkIn?.ids.includes(checkInId)) return {};
          const refused = new Set(
            results
              .filter(result => !result.success)
              .map(result => result.index),
          );
          // A line counts as added once sent; one refused goes back out.
          const added = [
            ...new Set([
              ...(draft.added ?? []),
              ...results
                .filter(result => result.success)
                .map(result => result.index),
            ]),
          ].filter(index => !refused.has(index));
          const failed: Partial<Record<number, ErrorCode>> = {};
          for (const { index, success, failure } of results) {
            if (!success && failure && isErrorCode(failure.code)) {
              failed[index] = failure.code;
            }
          }
          const stillFailed = {
            ...withoutIndexes(draft.failed, added),
            ...failed,
          };
          if (draft.checkIn.closed && Object.keys(stillFailed).length === 0) {
            return { draft: null };
          }
          return {
            draft: {
              ...draft,
              added,
              failed: stillFailed,
              checkIn: { ...draft.checkIn, state: 'idle' },
            },
          };
        }),
      closeReceipt: () =>
        set(({ draft }) => {
          if (!draft) return {};
          if (draft.checkIn && draft.checkIn.state !== 'idle') {
            return {
              draft: { ...draft, checkIn: { ...draft.checkIn, closed: true } },
            };
          }
          if (Object.keys(draft.failed ?? {}).length > 0) return {};
          return { draft: null };
        }),
      remintCheckInId: id => {
        const reminted = generateEntityId();
        set(({ draft }) =>
          draft?.checkIn
            ? {
                draft: {
                  ...draft,
                  checkIn: {
                    ...draft.checkIn,
                    ids: draft.checkIn.ids.map(held =>
                      held === id ? reminted : held,
                    ),
                  },
                },
              }
            : {},
        );
        return reminted;
      },
      setPurchasedOn: day =>
        set(({ draft }) =>
          draft ? { draft: { ...draft, purchasedOn: day } } : {},
        ),
      chooseStore: store =>
        set(({ draft }) => (draft ? { draft: { ...draft, store } } : {})),
      recordPhotoKeys: (scannedAt, keys, masked) =>
        set(({ draft }) =>
          draft?.scannedAt === scannedAt && !draft.parsed && !draft.serverParse
            ? {
                draft: {
                  ...draft,
                  photoKeys: keys,
                  ...(masked ? { photosMasked: true } : {}),
                },
              }
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
          if (typeof outcome === 'object' && 'parsed' in outcome) {
            const { serverParse: _asked, ...rest } = draft;
            // The day read on the phone, before redaction, stands.
            const purchasedOn = draft.purchasedOn ?? outcome.purchasedOn;
            return {
              draft: {
                ...rest,
                parsed: outcome.parsed,
                parsedBy: 'server',
                parseId: id,
                ...(purchasedOn ? { purchasedOn } : {}),
                ...(outcome.totalsGap ? { totalsGap: outcome.totalsGap } : {}),
                ...(outcome.printedStore
                  ? { printedStore: outcome.printedStore }
                  : {}),
              },
            };
          }
          // A photo parse that read nothing spent its photos, a limit's refusal
          // too (the API counts photo parses against a smaller allowance of
          // their own): a receipt with text is read from it at once.
          if (via === 'photos' && draft.pages.length > 0) {
            const {
              photoKeys: _spent,
              photosMasked: _masked,
              serverParse: _photoParse,
              ...text
            } = draft;
            return { draft: text };
          }
          const serverParse: ServerReceiptParse =
            typeof outcome === 'string'
              ? { id, via, state: outcome }
              : { id, via, state: 'limited', retryAt: outcome.retryAt };
          return { draft: { ...draft, serverParse } };
        }),
      clearDraft: () => set({ draft: null }),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => zustandStorage),
      // v3 adds `checkIn` and `failed`, both optional: a v2 draft reads as is.
      version: 3,
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
