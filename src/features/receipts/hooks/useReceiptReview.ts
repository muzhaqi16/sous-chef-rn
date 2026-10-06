import { useState } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { useToday } from '#hooks/useToday';
import { useOpenListLinesFor } from '#features/shoppingList/hooks/useOpenListLinesFor';
import { useShoppingListsLite } from '#features/shoppingList/hooks/useShoppingListsLite';
import { useActiveShoppingListId } from '#features/shoppingList/hooks/useActiveShoppingListId';
import {
  useReceiptDraft,
  useReceiptDraftActions,
  type ReceiptLineChoice,
} from '../store/receiptDraftStore';
import {
  receiptReviewLines,
  seedChoice,
  type ReceiptReviewLine,
} from '../utils/receiptReviewLines';
import { receiptTotalsGap } from '../utils/receiptTotalsGap';
import { forgetReceipt } from '../utils/forgetReceipt';
import {
  linkReceiptLines,
  listLineFor,
  type ListMatchKey,
} from '../utils/linkReceiptLines';
import { useApplyReceipt } from './useApplyReceipt';
import { useReceiptMatches, type ReceiptCandidate } from './useReceiptMatches';
import { useCreateStore } from '#features/catalog/hooks/useCreateStore';
import { toDateKey } from '#/utils/dateUtils';

// The chain and its store number print above the items (`ALDI` / `Store #027`).
const HEADER_LINES = 6;

/**
 * What adding does with a line: `add` it, add the API's unsure `guess` unless
 * the user picks another, or retry it after it `failed`; it is `added` already;
 * it waits for the API's match (`pending`); or it stays out as a line with no
 * match (`unmatched`) or one the user left out (`skipped`).
 */
export type ReceiptRowStatus =
  | 'add'
  | 'failed'
  | 'added'
  | 'pending'
  | 'guess'
  | 'unmatched'
  | 'skipped';

export interface ReceiptReviewRow extends ReceiptReviewLine {
  status: ReceiptRowStatus;
  choice?: ReceiptLineChoice;
  /** Items the API proposes for the line, best first. */
  candidates: ReceiptCandidate[];
  /** Why the last attempt to add it failed. */
  failure?: string;
  /** Adding it ticks a shopping-list line off rather than adding it again. */
  onList: boolean;
}

/**
 * The saved receipt's item lines, each with what the user chose it to be (else
 * the item the API is sure of) and the open line of the active shopping list
 * it matches, and the step that adds the chosen ones to the current pantry.
 */
export function useReceiptReview() {
  const draft = useReceiptDraft();
  const { chooseLine, setPurchasedOn, chooseStore, clearDraft } =
    useReceiptDraftActions();
  const today = useToday();
  const client = useApolloClient();
  // The product being picked in a line's sheet, asked about before it is saved.
  const [pickingItemId, setPickingItemId] = useState<string | null>(null);
  // The list the user works in, checked against the lists they still have.
  const { lists, loading: listsLoading } = useShoppingListsLite();
  const listId = useActiveShoppingListId(lists);
  const { pantryName, applying, failures, apply } = useApplyReceipt(listId);

  const lines = draft?.parsed ? receiptReviewLines(draft.parsed) : [];
  const [firstPage = ''] = draft?.pages ?? [];
  const {
    matchFor,
    matchState,
    retryMatching,
    resolvedStore,
    proposedStore,
    recordConfirmed,
  } = useReceiptMatches(
    lines.map(line => ({
      index: line.index,
      text: line.printed,
      code: line.code,
    })),
    // A receipt sent as photos keeps no pages: the merchant the server read stands in.
    firstPage.split('\n').slice(0, HEADER_LINES).join('\n') ||
      draft?.parsed?.merchant,
    draft?.parsedBy,
    draft?.store?.id,
    draft?.printedStore,
  );
  // A list line links by its catalog item, so the review asks only for the
  // lines naming an item a receipt line is, or may be.
  const {
    lines: openLines,
    loading: openLinesLoading,
    incomplete: listIncomplete,
  } = useOpenListLinesFor(
    listId,
    lines
      .flatMap(line => {
        const match = matchFor(line.index);
        const ids = [
          match?.preselect?.itemId,
          match?.guess?.itemId,
          draft?.choices?.[line.index]?.itemId,
          ...(match?.candidates ?? []).map(candidate => candidate.itemId),
        ];
        return ids.filter((itemId): itemId is string => !!itemId);
      })
      .concat(pickingItemId ?? []),
  );
  const { createStore } = useCreateStore();
  // Adding is busy from the store's create on: a second tap would add every line twice.
  const [placingStore, setPlacingStore] = useState(false);
  // What the user picked, else the store the receipt's header names.
  const store =
    draft?.store ??
    (resolvedStore ? { id: resolvedStore.id, name: resolvedStore.name } : null);
  // The server judges its own reading by the rule its lines follow, which
  // knows a discount it found was never taken off.
  const totalsGap =
    draft?.parsedBy === 'server'
      ? draft.totalsGap ?? null
      : draft?.parsed
      ? receiptTotalsGap(draft.parsed)
      : null;
  // A receipt that printed no readable day was bought the day it was scanned.
  const purchasedOn =
    draft?.purchasedOn ??
    (draft ? toDateKey(new Date(draft.scannedAt)) : today);

  const added = new Set(draft?.added);
  const chosen = lines.map(line => {
    const explicit = draft?.choices?.[line.index];
    const match = matchFor(line.index);
    // An unsure guess is added as is unless the user picks another: every
    // line the API matched needs no input.
    const proposed = match?.preselect ?? match?.guess;
    const proposal =
      explicit === undefined && proposed
        ? {
            ...seedChoice(line),
            itemId: proposed.itemId,
            itemName: proposed.itemName,
          }
        : undefined;
    return {
      line,
      match,
      // Null is the user leaving the line out, proposal or not.
      choice: explicit === undefined ? proposal : explicit ?? undefined,
      guessed: explicit === undefined && !match?.preselect && !!proposal,
      skipped: explicit === null,
    };
  });
  const pending = chosen.flatMap(({ line, choice }) =>
    choice && !added.has(line.index)
      ? [{ index: line.index, printed: line.printed, choice }]
      : [],
  );
  const links = linkReceiptLines(pending, openLines);

  const statusOf = (
    { line, choice, guessed, skipped }: (typeof chosen)[number],
    failure: string | undefined,
  ): ReceiptRowStatus => {
    if (added.has(line.index)) return 'added';
    if (choice) {
      if (failure) return 'failed';
      return guessed ? 'guess' : 'add';
    }
    if (skipped) return 'skipped';
    if (matchState !== 'done') return 'pending';
    return 'unmatched';
  };

  const rows: ReceiptReviewRow[] = chosen.map(entry => {
    const { line, match, choice } = entry;
    const failure = failures.find(
      failed => failed.index === line.index,
    )?.reason;
    return {
      ...line,
      status: statusOf(entry, failure),
      ...(choice ? { choice } : {}),
      candidates: match?.candidates ?? [],
      failure,
      onList: links.has(line.index),
    };
  });

  // Every other row keeps its link, so a line never shows one already taken.
  const listItemNameFor = (index: number, key: ListMatchKey) => {
    const held = new Set(
      [...links].flatMap(([other, line]) => (other === index ? [] : [line])),
    );
    const open = openLines.filter(line => !held.has(line));
    return listLineFor(key, open)?.itemName ?? undefined;
  };

  // The shop the receipt names but nobody has added: added now, on confirm,
  // and kept as the pick so a retry reuses it. A queued create's id names the
  // store at once, and the shop it merges into when it is already on file.
  const addProposedStore = async () => {
    if (!proposedStore) return undefined;
    const { name, address, storeNumber, chain } = proposedStore;
    const created = await createStore({
      name,
      ...(address ? { address } : {}),
      // A store number means something only within its chain.
      ...(chain
        ? { chainId: chain.id, ...(storeNumber ? { storeNumber } : {}) }
        : {}),
    });
    if (created) chooseStore(created);
    return created?.id;
  };

  const addChosen = async () => {
    setPlacingStore(true);
    const storeId = store?.id ?? (await addProposedStore());
    setPlacingStore(false);
    const outcome = await apply(
      pending.map(line => ({ ...line, listLine: links.get(line.index) })),
      { purchasedOn, ...(storeId ? { storeId } : {}) },
    );
    // Only catalog items can be remembered: a typed name has no id yet.
    void recordConfirmed(
      pending.flatMap(({ index, printed, choice }) =>
        choice.itemId && outcome.addedIndexes.includes(index)
          ? [{ index, text: printed, itemId: choice.itemId }]
          : [],
      ),
      storeId,
    );
    return { added: outcome.addedIndexes.length, failed: outcome.failed };
  };

  return {
    rows,
    merchant: draft?.parsed?.merchant ?? null,
    /** The receipt's store: the user's pick, else the one its header names. */
    store,
    /** The shop the receipt names that is not on file; added on confirm. */
    proposedStoreName: proposedStore?.name ?? null,
    /** Neither the receipt nor the API names the shop, so the user is asked for it. */
    storeUnrecognized: !resolvedStore && !draft?.parsed?.merchant,
    /** The day of the shop, YYYY-MM-DD; the scan's day when none was read. */
    purchasedOn,
    /** No day was read from the receipt and the user set none: it is the scan's. */
    dayIsScanDay: !draft?.purchasedOn,
    setPurchasedOn,
    chooseStore,
    /** The read lines disagree with the receipt's own total: one may be missing. */
    totalsGap,
    /** Whether the API has matched the lines, is matching them, or could not be asked. */
    matchState,
    retryMatching,
    pantryName,
    pendingCount: pending.length,
    applying: applying || placingStore,
    /** Later list pages are still loading: adding now could miss a list line. */
    listLoading: openLinesLoading || (listsLoading && lists.length === 0),
    /** The list is longer than the review can see, so a line may miss its list line. */
    listIncomplete,
    chooseLine,
    /** The list line a line would tick off with this product and unit, as they are picked. */
    listItemNameFor,
    /** Names the product a line's sheet has picked, or null once it closes. */
    pickItem: setPickingItemId,
    addChosen,
    finish: () => {
      const parseId = draft?.serverParse?.id;
      clearDraft();
      forgetReceipt(client.cache, parseId);
    },
  };
}
