import { skipToken, useMutation, useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  NetWeightKind,
  ReceiptMatchConfidence,
  ReceiptParser,
  type ReceiptMatchMethod,
} from '#/graphql/generated/schemaTypes';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { usePreservedQueryData } from '#hooks/apollo/usePreservedQueryData';
import { generateEntityId } from '#/utils/generateEntityId';
import { useCurrentPantry } from '#features/pantry/hooks/useCurrentPantry';
import { formatNetWeightDisplay } from '#/utils/formatQuantity';
import {
  RecordReceiptMatchesDocument,
  ResolveReceiptLinesDocument,
  type ResolveReceiptLinesQuery,
} from './useReceiptMatches.generated';
import type { PrintedStore } from '../store/receiptDraftStore';

/** A catalog item the API proposes for a receipt line. */
export interface ReceiptCandidate {
  itemId: string;
  itemName: string;
  /**
   * What sets it apart from another candidate of the same name: its brand,
   * else its pack size. None when no other candidate shares its name.
   */
  detail: string | null;
  method: ReceiptMatchMethod;
}

export interface ReceiptLineMatch {
  /** Preselected when the API is sure of it (HIGH or MEDIUM). */
  preselect?: ReceiptCandidate;
  /** The API's best guess, offered but not preselected (LOW). */
  guess?: ReceiptCandidate;
  candidates: ReceiptCandidate[];
}

export interface ReceiptMatchLine {
  index: number;
  /** The product words as printed. */
  text: string;
  code?: string;
}

/** Whether the API has said which items the lines are, is asking, or could not be asked. */
export type ReceiptMatchState = 'matching' | 'failed' | 'done';

export interface ConfirmedReceiptLine {
  index: number;
  text: string;
  itemId: string;
}

// The API's cap per call.
const MAX_LINES = 100;

const SURE = new Set([
  ReceiptMatchConfidence.High,
  ReceiptMatchConfidence.Medium,
]);

type ResolvedCandidate =
  ResolveReceiptLinesQuery['resolveReceiptLines']['lines'][number]['candidates'][number];

const candidateDetail = ({ item }: ResolvedCandidate): string | null => {
  const [onlyBrand, ...otherBrands] = item.brands;
  if (onlyBrand && otherBrands.length === 0) return onlyBrand.brand.name;
  return item.netWeightKind === NetWeightKind.Package
    ? formatNetWeightDisplay(item.netWeight, item.displayUnit)
    : null;
};

const toCandidate = (
  candidate: ResolvedCandidate,
  among: readonly ResolvedCandidate[],
): ReceiptCandidate => {
  const { id, name } = candidate.item;
  const sharesItsName = among.some(
    other => other.item.id !== id && other.item.name === name,
  );
  return {
    itemId: id,
    itemName: name,
    detail: sharesItsName ? candidateDetail(candidate) : null,
    method: candidate.method,
  };
};

/**
 * The catalog items the API proposes for a receipt's item lines, and the step
 * that tells it which ones the household confirmed, so the same printed line at
 * the same store resolves to them next time. A store the user picked wins over
 * the one the receipt names, for the matches and for what is remembered.
 */
export function useReceiptMatches(
  lines: readonly ReceiptMatchLine[],
  merchantHeader: string | undefined,
  parsedBy: 'device' | 'server' | undefined,
  pickedStoreId: string | undefined,
  printedStore: PrintedStore | undefined,
) {
  const { t } = useTranslation();
  const { pantry, currentHome } = useCurrentPantry();
  const sent = lines.slice(0, MAX_LINES);
  // Asked once the pantry is known (or known to be none), never twice.
  const pantryKnown = !!pantry || !!currentHome;

  const { data, loading, error, refetch } = useQuery(
    ResolveReceiptLinesDocument,
    sent.length > 0 && pantryKnown
      ? {
          variables: {
            input: {
              merchantHeader,
              ...(printedStore ? { merchant: printedStore } : {}),
              ...(pickedStoreId ? { storeId: pickedStoreId } : {}),
              pantryId: pantry?.id,
              parsedBy:
                parsedBy === 'server'
                  ? ReceiptParser.Server
                  : ReceiptParser.Device,
              lines: sent.map(line => ({
                clientId: String(line.index),
                text: line.text,
                code: line.code,
              })),
            },
          },
          // A lookup for one receipt: nothing to resync, and a return to the
          // review reads the answer it already has.
          refetchOn: false,
          fetchPolicy: 'cache-first',
        }
      : skipToken,
  );
  // A picked store asks again for the same lines: the last answer stands until
  // the new one lands, so the proposals stay on screen.
  const answer = usePreservedQueryData(data, undefined, JSON.stringify(sent));
  const resolved = answer?.resolveReceiptLines;
  const storeId = pickedStoreId ?? resolved?.store?.id;

  const matches = new Map<number, ReceiptLineMatch>();
  for (const line of resolved?.lines ?? []) {
    const best = line.best
      ? toCandidate(line.best, line.candidates)
      : undefined;
    const sure = SURE.has(line.confidence);
    matches.set(Number(line.clientId), {
      ...(best && sure ? { preselect: best } : {}),
      ...(best && !sure ? { guess: best } : {}),
      candidates: line.candidates.map(candidate =>
        toCandidate(candidate, line.candidates),
      ),
    });
  }

  // Queued like any local-first write, so a receipt added offline still teaches
  // the matcher once the phone is back online.
  const [record] = useMutation(RecordReceiptMatchesDocument, {
    context: { localFirst: true },
  });

  /** `placedStoreId` names a store added on confirm, before a pick could. */
  const recordConfirmed = async (
    confirmed: readonly ConfirmedReceiptLine[],
    placedStoreId?: string,
  ) => {
    if (!currentHome || confirmed.length === 0) return;
    const recordedStoreId = placedStoreId ?? storeId;
    await settleMutation(
      () =>
        record({
          variables: {
            input: {
              idempotencyKey: generateEntityId(),
              homeId: currentHome.id,
              ...(recordedStoreId
                ? { storeId: recordedStoreId }
                : { merchantHeader }),
              lines: confirmed.slice(0, MAX_LINES).map(line => {
                const match = matches.get(line.index);
                const proposed = match?.preselect ?? match?.guess;
                return {
                  rawText: line.text,
                  itemId: line.itemId,
                  resolvedBy: proposed?.method ?? null,
                  edited: proposed?.itemId !== line.itemId,
                };
              }),
            },
          },
        }),
      {
        document: RecordReceiptMatchesDocument,
        fallback: t('errors.generic'),
        // The pantry has the lines either way; this only teaches the matcher.
        present: 'none',
      },
    );
  };

  const answered = sent.length === 0 || !!answer;
  const matchState: ReceiptMatchState = answered
    ? 'done'
    : error && !loading
    ? 'failed'
    : 'matching';

  return {
    matchFor: (index: number) => matches.get(index),
    matchState,
    /** Asks again after a lookup that failed. */
    retryMatching: () => {
      void refetch().catch(() => undefined);
    },
    /**
     * The store the API resolved from the receipt's header, when it knows it.
     * Never the picked one, which the API echoes as the receipt's store.
     */
    resolvedStore: pickedStoreId ? null : resolved?.store ?? null,
    /** The store the receipt names that is not on file, to add on confirm. */
    proposedStore: pickedStoreId ? null : resolved?.proposedStore ?? null,
    recordConfirmed,
  };
}
