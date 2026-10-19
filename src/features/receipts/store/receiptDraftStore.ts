import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { zustandStorage } from '#/storage/mmkv';
import { registerSessionScopedStore } from '#store/sessionScopedStores';
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
      purchaseTime?: string;
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
  /**
   * The time of the sale printed with that day (HH:MM, the store's clock). It
   * stays when the user changes the day.
   */
  purchaseTime?: string;
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
  chooseLine: (index: number, choice: ReceiptLineChoice | null) => void;
  markAdded: (indexes: readonly number[]) => void;
  /** Keeps every id already minted. */
  ensureCheckInIds: (indexes: readonly number[], sends: number) => void;
  setCheckInState: (state: ReceiptCheckIn['state']) => void;
  /** Ignored for a check-in the draft does not hold. */
  settleCheckIn: (
    checkInId: string,
    results: readonly CheckInLineOutcome[],
  ) => void;
  /** For an id another user holds: a resend is known by its purchase ids. */
  remintCheckInId: (id: string) => string;
  /**
   * Keeps a receipt still sending or queued until it lands, and one with a
   * refused line for its retry; else the draft goes.
   */
  closeReceipt: () => void;
  setPurchasedOn: (day: string) => void;
  chooseStore: (store: { id: string; name: string }) => void;
  /** Ignored once its draft is gone, read or asked: an upload outlives it. */
  recordPhotoKeys: (scannedAt: string, keys: string[], masked: boolean) => void;
  /** Ignored once the draft is read or asked, unless a limit turned it away. */
  askServerParse: (id: string, via: ServerReceiptParse['via']) => void;
  /** Ignored once the draft has moved on from parse `id`. */
  settleServerParse: (
    id: string,
    outcome: ServerParseOutcome | { retryAt: string },
  ) => void;
  clearDraft: () => void;
}

const PERSIST_KEY = 'sous-chef-receipt-draft';

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
    set => {
      // Merges what `change` returns into the draft; null keeps it as it is.
      const patchDraft = (
        change: (draft: ReceiptDraft) => Partial<ReceiptDraft> | null,
      ) =>
        set(({ draft }) => {
          const fields = draft ? change(draft) : null;
          return draft && fields ? { draft: { ...draft, ...fields } } : {};
        });
      return {
        draft: null,
        saveDraft: draft => set({ draft }),
        chooseLine: (index, choice) =>
          patchDraft(({ choices }) => ({
            choices: { ...choices, [index]: choice },
          })),
        markAdded: indexes =>
          patchDraft(({ added, failed }) => ({
            added: [...new Set([...(added ?? []), ...indexes])],
            failed: withoutIndexes(failed, indexes),
          })),
        ensureCheckInIds: (indexes, sends) =>
          patchDraft(({ checkIn }) => ({
            checkIn: withCheckInIds(checkIn, indexes, sends),
          })),
        setCheckInState: state =>
          patchDraft(({ checkIn }) =>
            checkIn ? { checkIn: { ...checkIn, state } } : null,
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
                draft: {
                  ...draft,
                  checkIn: { ...draft.checkIn, closed: true },
                },
              };
            }
            if (Object.keys(draft.failed ?? {}).length > 0) return {};
            return { draft: null };
          }),
        remintCheckInId: id => {
          const reminted = generateEntityId();
          patchDraft(({ checkIn }) =>
            checkIn
              ? {
                  checkIn: {
                    ...checkIn,
                    ids: checkIn.ids.map(held =>
                      held === id ? reminted : held,
                    ),
                  },
                }
              : null,
          );
          return reminted;
        },
        setPurchasedOn: day => patchDraft(() => ({ purchasedOn: day })),
        chooseStore: store => patchDraft(() => ({ store })),
        recordPhotoKeys: (scannedAt, keys, masked) =>
          patchDraft(draft =>
            draft.scannedAt === scannedAt && !draft.parsed && !draft.serverParse
              ? { photoKeys: keys, ...(masked ? { photosMasked: true } : {}) }
              : null,
          ),
        askServerParse: (id, via) =>
          patchDraft(({ parsed, serverParse }) =>
            !parsed && (!serverParse || serverParse.state === 'limited')
              ? { serverParse: { id, via, state: 'pending' } }
              : null,
          ),
        settleServerParse: (id, outcome) =>
          set(({ draft }) => {
            if (draft?.serverParse?.id !== id) return {};
            const { via } = draft.serverParse;
            if (typeof outcome === 'object' && 'parsed' in outcome) {
              const { serverParse: _asked, ...rest } = draft;
              // The day read on the phone, before redaction, stands; a time
              // joins it only from a reading of the same day.
              const purchasedOn = draft.purchasedOn ?? outcome.purchasedOn;
              const purchaseTime =
                draft.purchaseTime ??
                (purchasedOn === outcome.purchasedOn
                  ? outcome.purchaseTime
                  : undefined);
              return {
                draft: {
                  ...rest,
                  parsed: outcome.parsed,
                  parsedBy: 'server',
                  parseId: id,
                  ...(purchasedOn ? { purchasedOn } : {}),
                  ...(purchaseTime ? { purchaseTime } : {}),
                  ...(outcome.totalsGap
                    ? { totalsGap: outcome.totalsGap }
                    : {}),
                  ...(outcome.printedStore
                    ? { printedStore: outcome.printedStore }
                    : {}),
                },
              };
            }
            // A photo parse that read nothing spent its photos, as does a limit's
            // refusal (photo parses have a smaller allowance of their own): a
            // receipt with text is read from it at once.
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
      };
    },
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => zustandStorage),
      version: 3,
      partialize: state => ({ draft: state.draft }),
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
