import { skipToken, useQuery } from '@apollo/client/react';
import {
  NetWeightKind,
  ReceiptMatchConfidence,
  ReceiptParser,
  type ReceiptMatchMethod,
} from '#/graphql/generated/schemaTypes';
import { usePreservedQueryData } from '#hooks/apollo/usePreservedQueryData';
import { useCurrentPantry } from '#features/pantry/hooks/useCurrentPantry';
import { formatNetWeightDisplay } from '#/utils/formatQuantity';
import {
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

/** One choice per text the sheet shows: the first such item in the API's order. */
const distinctChoices = (
  candidates: ReceiptCandidate[],
): ReceiptCandidate[] => {
  const shown = new Set<string>();
  return candidates.filter(({ itemName, detail }) => {
    const label = `${itemName}\n${detail ?? ''}`;
    if (shown.has(label)) return false;
    shown.add(label);
    return true;
  });
};

/**
 * The catalog items the API proposes for a receipt's lines, and the step that
 * confirms them, so the same printed line at the same store resolves to them
 * next time. A store the user picked beats the receipt's, for both.
 */
export function useReceiptMatches(
  lines: readonly ReceiptMatchLine[],
  merchantHeader: string | undefined,
  parsedBy: 'device' | 'server' | undefined,
  pickedStoreId: string | undefined,
  printedStore: PrintedStore | undefined,
) {
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

  const matches = new Map<number, ReceiptLineMatch>();
  for (const line of resolved?.lines ?? []) {
    const best = line.best
      ? toCandidate(line.best, line.candidates)
      : undefined;
    const sure = SURE.has(line.confidence);
    matches.set(Number(line.clientId), {
      ...(best && sure ? { preselect: best } : {}),
      ...(best && !sure ? { guess: best } : {}),
      candidates: distinctChoices(
        line.candidates.map(candidate =>
          toCandidate(candidate, line.candidates),
        ),
      ),
    });
  }

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
    /**
     * The household's unlocated store of the proposed name, which a check-in
     * with the receipt's parse locates: offered, never placed. None once a
     * store is picked or the receipt names one.
     */
    completableStore:
      pickedStoreId || resolved?.store
        ? null
        : resolved?.completableStore ?? null,
  };
}
