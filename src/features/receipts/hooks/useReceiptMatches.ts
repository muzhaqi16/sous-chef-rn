import { skipToken, useMutation, useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  ReceiptMatchConfidence,
  ReceiptParser,
  type ReceiptMatchMethod,
} from '#/graphql/generated/schemaTypes';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { useCurrentPantry } from '#features/pantry/hooks/useCurrentPantry';
import {
  RecordReceiptMatchesDocument,
  ResolveReceiptLinesDocument,
} from './useReceiptMatches.generated';

/** A catalog item the API proposes for a receipt line. */
export interface ReceiptCandidate {
  itemId: string;
  itemName: string;
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

const toCandidate = (candidate: {
  method: ReceiptMatchMethod;
  item: { id: string; name: string };
}): ReceiptCandidate => ({
  itemId: candidate.item.id,
  itemName: candidate.item.name,
  method: candidate.method,
});

/**
 * The catalog items the API proposes for a receipt's item lines, and the step
 * that tells it which ones the household confirmed, so the same printed line at
 * the same chain resolves to them next time.
 */
export function useReceiptMatches(
  lines: readonly ReceiptMatchLine[],
  merchantHeader: string | undefined,
  parsedBy: 'device' | 'server' | undefined,
) {
  const { t } = useTranslation();
  const { pantry, currentHome } = useCurrentPantry();
  const sent = lines.slice(0, MAX_LINES);

  const { data, loading } = useQuery(
    ResolveReceiptLinesDocument,
    sent.length > 0
      ? {
          variables: {
            input: {
              merchantHeader,
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
          // A lookup for one receipt: nothing to resync.
          refetchOn: false,
        }
      : skipToken,
  );
  const resolved = data?.resolveReceiptLines;
  const storeId = resolved?.store?.id;

  const matches = new Map<number, ReceiptLineMatch>();
  for (const line of resolved?.lines ?? []) {
    const best = line.best ? toCandidate(line.best) : undefined;
    const sure = SURE.has(line.confidence);
    matches.set(Number(line.clientId), {
      ...(best && sure ? { preselect: best } : {}),
      ...(best && !sure ? { guess: best } : {}),
      candidates: line.candidates.map(toCandidate),
    });
  }

  // Queued like any local-first write, so a receipt added offline still teaches
  // the matcher once the phone is back online.
  const [record] = useMutation(RecordReceiptMatchesDocument, {
    context: { localFirst: true },
  });

  const recordConfirmed = async (
    confirmed: readonly ConfirmedReceiptLine[],
  ) => {
    if (!currentHome || confirmed.length === 0) return;
    await settleMutation(
      () =>
        record({
          variables: {
            input: {
              idempotencyKey: generateEntityId(),
              homeId: currentHome.id,
              ...(storeId ? { storeId } : { merchantHeader }),
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

  return {
    matchFor: (index: number) => matches.get(index),
    /** Still asking the API which items the lines are. */
    matching: loading && !data,
    /** The receipt's store, when the API knows it. */
    storeId,
    recordConfirmed,
  };
}
