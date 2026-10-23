import { useState } from 'react';
import { useApolloClient, useFragment } from '@apollo/client/react';
import { useTranslation, type TranslationKey } from '#/i18n';
import { useToday } from '#hooks/app/useToday';
import { errorService } from '#/services/errorService';
import { useCurrentPantry } from '#features/pantry/hooks/useCurrentPantry';
import { usePantryIntake } from '#features/pantry/hooks/usePantryIntake';
import { useResolveUnit } from '#features/catalog/hooks/useResolveUnit';
import { useOpenListLinesFor } from '#features/shoppingList/hooks/useOpenListLinesFor';
import { useShoppingListsLite } from '#features/shoppingList/hooks/useShoppingListsLite';
import { useActiveShoppingListId } from '#features/shoppingList/hooks/useActiveShoppingListId';
import {
  useReceiptDraft,
  useReceiptDraftActions,
  useReceiptDraftStore,
  type ReceiptLineChoice,
} from '../store/receiptDraftStore';
import {
  orderDiscountOf,
  receiptReviewLines,
  seedChoice,
  type ReceiptReviewLine,
} from '../utils/receiptReviewLines';
import { checkInLineOf, type CheckInLineNeed } from '../utils/checkInLine';
import { forgetReceipt } from '../utils/forgetReceipt';
import {
  linkReceiptLines,
  listLineFor,
  type ListMatchKey,
} from '../utils/linkReceiptLines';
import {
  LINES_PER_CHECK_IN,
  useReceiptCheckIn,
  type CheckInLineToSend,
} from './useReceiptCheckIn';
import { useReceiptMatches, type ReceiptCandidate } from './useReceiptMatches';
import { UseReceiptReview_StoreFragmentDoc } from './useReceiptReview.generated';
import { useHeldStores } from './useHeldStores';
import { unlocatedStoreNamed } from '../utils/unlocatedStoreNamed';
import { storeOfferOf } from '../utils/storeOfferOf';
import { purchaseMomentOf } from '../utils/receiptDate';
import { useCreateStore } from '#features/catalog/hooks/useCreateStore';
import { toDateKey } from '#/utils/dateUtils';
import { firstNonBlank } from '#/utils/firstNonBlank';

// The chain and its store number print above the items (`ALDI` / `Store #027`).
const HEADER_LINES = 6;

const NEED_COPY: Record<CheckInLineNeed, TranslationKey> = {
  item: 'errors.itemNameRequired',
  unit: 'receipts.review.needsUnit',
  price: 'receipts.review.totalNeeded',
};

/**
 * What adding does with a line: `add` it, add the API's unsure `guess` unless
 * the user picks another, retry it once `failed`; or nothing: `added` already,
 * `pending` the API's match, `unmatched`, or `skipped` by the user.
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
  const { t } = useTranslation();
  const draft = useReceiptDraft();
  const {
    chooseLine,
    setPurchasedOn,
    chooseStore,
    ensureCheckInIds,
    closeReceipt,
  } = useReceiptDraftActions();
  const today = useToday();
  const client = useApolloClient();
  // The product being picked in a line's sheet, asked about before it is saved.
  const [pickingItemId, setPickingItemId] = useState<string | null>(null);
  // The list the user works in, checked against the lists they still have.
  const { lists, loading: listsLoading } = useShoppingListsLite();
  const listId = useActiveShoppingListId(lists);
  const { pantry } = useCurrentPantry();
  const pantryId = pantry?.id;
  const { heldUnitOf } = usePantryIntake(pantryId);
  const { resolveUnitId } = useResolveUnit();
  const { checkIn } = useReceiptCheckIn(listId);
  // What the lines held back at the last Add still lack, by line index.
  const [needs, setNeeds] = useState<Partial<Record<number, CheckInLineNeed>>>(
    {},
  );
  const [preparing, setPreparing] = useState(false);

  const lines = draft?.parsed ? receiptReviewLines(draft.parsed) : [];
  const [firstPage = ''] = draft?.pages ?? [];
  // A receipt sent as photos keeps no pages: the merchant the server read stands in.
  const merchantHeader =
    firstPage.split('\n').slice(0, HEADER_LINES).join('\n') ||
    draft?.parsed?.merchant;
  const {
    matchFor,
    matchState,
    retryMatching,
    resolvedStore,
    proposedStore,
    completableStore,
  } = useReceiptMatches(
    lines.map(line => ({
      index: line.index,
      text: line.printed,
      code: line.code,
    })),
    merchantHeader,
    draft?.parsedBy,
    draft?.store?.id,
    draft?.printedStore,
  );
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
  // A list line links by its catalog item, so the review asks only for the
  // lines naming an item a receipt line is. What a line may be instead rides
  // along while the lookup has room, so picking one shows its list line at once.
  const {
    lines: openLines,
    loading: openLinesLoading,
    incomplete: listIncomplete,
  } = useOpenListLinesFor(
    listId,
    chosen
      .flatMap(({ choice }) => choice?.itemId ?? [])
      .concat(pickingItemId ?? []),
    chosen.flatMap(({ match }) => {
      const ids = [
        match?.preselect?.itemId,
        match?.guess?.itemId,
        ...(match?.candidates ?? []).map(candidate => candidate.itemId),
      ];
      return ids.filter((itemId): itemId is string => !!itemId);
    }),
  );
  const { createStore } = useCreateStore();
  // What the user picked, else the store the receipt's header names.
  const store =
    draft?.store ??
    (resolvedStore ? { id: resolvedStore.id, name: resolvedStore.name } : null);
  // Read live by id: a store the user picks was read with its address.
  const placed = useFragment({
    fragment: UseReceiptReview_StoreFragmentDoc,
    fragmentName: 'useReceiptReview_store',
    from: store ? { __typename: 'Store', id: store.id } : null,
  });
  // The server's reading, which the check-in locates an unlocated store from.
  const receiptParseId =
    draft?.parsedBy === 'server' ? draft.parseId : undefined;
  const picked = placed.complete ? placed.data : null;
  // A pick with no place of its own is placed where the receipt says on check-in.
  const takesReceiptPlace =
    !!picked &&
    !!receiptParseId &&
    !firstNonBlank(picked.address, picked.storeNumber);
  const pickedPlace = takesReceiptPlace ? draft?.printedStore ?? null : picked;
  const located = store ? pickedPlace : proposedStore;
  const heldStores = useHeldStores(listId);
  // Offered, never placed.
  const storeOffer = storeOfferOf(
    { parseId: receiptParseId, store },
    matchState,
    {
      api: completableStore
        ? { id: completableStore.id, name: completableStore.name }
        : null,
      device: unlocatedStoreNamed(
        [
          draft?.parsed?.merchant,
          draft?.printedStore?.name,
          proposedStore?.name,
          proposedStore?.chain?.name,
        ],
        heldStores,
      ),
    },
  );
  // Judged where it was read, by the rule its lines follow: the server's, or
  // the same rules on the phone, which know a discount never taken off.
  const totalsGap = draft?.totalsGap ?? null;
  // A receipt that printed no readable day was bought the day it was scanned.
  const purchasedOn =
    draft?.purchasedOn ??
    (draft ? toDateKey(new Date(draft.scannedAt)) : today);

  const added = new Set(draft?.added);
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

  // Why a line did not land: what it still lacks, else the API's refusal,
  // told from its code.
  const failureOf = (index: number): string | undefined => {
    const need = needs[index];
    if (need) return t(NEED_COPY[need]);
    const code = draft?.failed?.[index];
    if (code === undefined) return undefined;
    return code
      ? errorService.messageForCode(code, t, t('errors.addItemFailedRetry'))
      : t('errors.addItemFailedRetry');
  };

  const rows: ReceiptReviewRow[] = chosen.map(entry => {
    const { line, match, choice } = entry;
    const failure = failureOf(line.index);
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

  /**
   * Records the chosen lines in one check-in, without waiting on the API: every
   * line shows in the pantry before this returns. A line that still lacks its
   * product, unit or price stays, saying which.
   */
  const addChosen = async (): Promise<{ sent: number; held: number }> => {
    if (!pantryId) return { sent: 0, held: pending.length };
    setPreparing(true);
    // A typed unit goes as the unit it names, from the device's units first.
    const resolved = await Promise.all(
      pending.map(async entry => ({
        ...entry,
        choice: {
          ...entry.choice,
          unitId: await resolveUnitId(
            entry.choice.unitId,
            entry.choice.unitText,
          ),
        },
      })),
    );
    setPreparing(false);
    ensureCheckInIds(
      resolved.map(entry => entry.index),
      Math.max(1, Math.ceil(resolved.length / LINES_PER_CHECK_IN)),
    );
    const minted = useReceiptDraftStore.getState().draft?.checkIn;
    if (!minted) return { sent: 0, held: pending.length };

    const toSend: CheckInLineToSend[] = [];
    const lacking: Partial<Record<number, CheckInLineNeed>> = {};
    for (const entry of resolved) {
      const ids = minted.lines[entry.index];
      const line = lines.find(candidate => candidate.index === entry.index);
      if (!ids || !line) continue;
      const listLine = links.get(entry.index);
      const itemId = entry.choice.itemId ?? listLine?.item?.id;
      const match = matchFor(entry.index);
      const built = checkInLineOf({
        line,
        choice: entry.choice,
        ids,
        listLine,
        heldUnit: itemId ? heldUnitOf(itemId) : null,
        proposed: match?.preselect ?? match?.guess,
      });
      if ('needs' in built) {
        lacking[entry.index] = built.needs;
        continue;
      }
      toSend.push({
        index: entry.index,
        input: built.input,
        itemName: entry.choice.itemName,
        ...(listLine ? { listLine } : {}),
      });
    }
    setNeeds(lacking);

    const orderDiscount = draft?.parsed ? orderDiscountOf(draft.parsed) : 0;
    if (toSend.length > 0) {
      checkIn(
        {
          checkInIds: minted.ids,
          pantryId,
          purchasedOn,
          purchasedAt: purchaseMomentOf(purchasedOn, draft?.purchaseTime),
          // Online, the check-in waits for the store's create; its lines don't.
          storeId: store?.id ?? addProposedStore(),
          ...(listId && links.size > 0 ? { shoppingListId: listId } : {}),
          ...(receiptParseId ? { receiptParseId } : {}),
          ...(!store && merchantHeader ? { merchantHeader } : {}),
          ...(orderDiscount ? { orderDiscount } : {}),
        },
        toSend,
      ).catch((error: unknown) => {
        errorService.reportError(error, { operation: 'Check in a receipt' });
      });
    }
    return { sent: toSend.length, held: Object.keys(lacking).length };
  };

  return {
    rows,
    merchant: draft?.parsed?.merchant ?? null,
    /** The receipt's store: the user's pick, else the one its header names. */
    store,
    /** The shop the receipt names that is not on file; added on confirm. */
    proposedStoreName: proposedStore?.name ?? null,
    /** Where the store, or the proposed one, is: which branch of a chain. */
    storeLocation: located
      ? {
          address: firstNonBlank(located.address) ?? null,
          storeNumber: located.storeNumber ?? null,
        }
      : null,
    /**
     * A store on file with no address that this receipt's address would
     * complete, offered before adding a new one; picked with `chooseStore`.
     */
    storeOffer,
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
    pantryName: pantry?.name ?? null,
    pendingCount: pending.length,
    /** Resolving the lines' units before they are sent. */
    applying: preparing,
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
    /**
     * The review is done. A receipt still landing, or with a refused line to
     * retry, stays saved; one that went keeps no lookups behind it.
     */
    finish: () => {
      const parseId = draft?.parseId ?? draft?.serverParse?.id;
      closeReceipt();
      if (!useReceiptDraftStore.getState().draft) {
        forgetReceipt(client.cache, parseId);
      }
    },
  };
}
