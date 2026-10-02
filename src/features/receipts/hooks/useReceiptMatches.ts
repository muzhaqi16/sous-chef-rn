import { useState } from 'react';
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
 * the same chain resolves to them next time. A store the user picked wins over
 * the one the header names, for the matches and for what is remembered.
 */
export function useReceiptMatches(
  lines: readonly ReceiptMatchLine[],
  merchantHeader: string | undefined,
  parsedBy: 'device' | 'server' | undefined,
  pickedStoreId: string | undefined,
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
          // A lookup for one receipt: nothing to resync.
          refetchOn: false,
        }
      : skipToken,
  );
  // A picked store asks again for the same lines: the last answer stands until
  // the new one lands, so the proposals stay on screen.
  const linesKey = JSON.stringify(sent);
  const [held, setHeld] = useState<{ key: string; data: typeof data }>();
  if (data && data !== held?.data) setHeld({ key: linesKey, data });
  const answer = data ?? (held?.key === linesKey ? held.data : undefined);
  const resolved = answer?.resolveReceiptLines;
  const storeId = pickedStoreId ?? resolved?.store?.id;

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
    recordConfirmed,
  };
}
