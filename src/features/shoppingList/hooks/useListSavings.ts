import { skipToken, useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import type { Translate } from '#/i18n/types';
import {
  StoreLineMatch,
  type UnitSystem,
} from '#/graphql/generated/schemaTypes';
import { usePreservedQueryData } from '#hooks/apollo/usePreservedQueryData';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import { chainOption, storeOption, type StoreOption } from '#domain/stores';
import { formatMonthDay } from '#/utils/formatters/date';
import {
  formatApproximateCurrency,
  formatCurrency,
  formatDistance,
} from '#/utils/formatters/number';
import { formatQuantityWithUnit } from '#/utils/formatQuantity';
import { resolveImageUrl } from '#utils/imageUtils';
import {
  ListSavingsDocument,
  type ListSavingsQuery,
} from './useListSavings.generated';

type Answer = ListSavingsQuery['shoppingListStoreSavings'];
type Candidate = Answer['candidates'][number];
type Line = Candidate['lines'][number];

/** How a line is priced at a store, as the server judged it. */
export type SavingsLineKind = 'same' | 'similar' | 'estimated' | 'none';

/** One line at one store, worded. */
export interface SavingsLine {
  lineId: string;
  name: string;
  photoUrl: string | null;
  kind: SavingsLineKind;
  /** What the line's quantity costs there; null for no price. */
  price: string | null;
  /** The product a similar price came from, and its size. */
  product: string | null;
  /** When a stale price was seen. */
  lastSeen: string | null;
  /** The line's price at the list's store, at another store. */
  atListStore: string | null;
  /** Against the list's store, where both price it on the shelf. */
  difference: { kind: 'cheaper' | 'dearer'; amount: string } | null;
}

/** What a store saves against the list's store, worded. */
export type StoreSaving =
  | { kind: 'aboutTheSame'; coveredLines: number }
  | { kind: 'save' | 'more'; amount: string; coveredLines: number };

/** One store the list is compared at. */
export interface SavingsStore {
  option: StoreOption;
  isTarget: boolean;
  /** Null until its own and similar prices cover half the lines. */
  total: string | null;
  saving: StoreSaving | null;
  /** "Prices from ALDI Wilkinsburg, 4 mi away": where its prices come from. */
  standIn: string | null;
  lines: SavingsLine[];
}

export interface ListSavings {
  /** When the server answered: the prices are as of then. */
  answeredAt: string;
  stores: SavingsStore[];
}

// A kind this build doesn't know reads as no price, never as a blank.
const kindOf = (kind: StoreLineMatch): SavingsLineKind => {
  switch (kind) {
    case StoreLineMatch.Same:
      return 'same';
    case StoreLineMatch.Similar:
      return 'similar';
    case StoreLineMatch.Estimated:
      return 'estimated';
    case StoreLineMatch.None:
    default:
      return 'none';
  }
};

const onShelf = (kind: SavingsLineKind) =>
  kind === 'same' || kind === 'similar';

/**
 * The answer, worded: every rule (kinds, the 8-day staleness, half coverage,
 * the lines a saving covers, "about the same", stand-ins) is the server's.
 */
function toListSavings(
  answer: Answer,
  t: Translate,
  readingSystem: UnitSystem,
): ListSavings {
  const { code, decimalPlaces } = answer.currency;
  const money = (amount: number) => formatCurrency(amount, code, decimalPlaces);
  // "About": to the whole unit, where one is not too coarse.
  const roughly = (amount: number) =>
    Math.abs(amount) >= 1
      ? formatApproximateCurrency(Math.abs(amount), code)
      : money(Math.abs(amount));
  const minor = (amount: number) => Math.round(amount * 10 ** decimalPlaces);

  const target = answer.candidates.find(candidate => candidate.isTarget);
  const atTarget = new Map(
    (target?.lines ?? []).map(line => [line.line.id, line]),
  );

  const lineOf = (line: Line, isTarget: boolean): SavingsLine => {
    const kind = kindOf(line.kind);
    const amount = kind === 'none' ? null : line.amount;
    const there = isTarget ? undefined : atTarget.get(line.line.id);
    const thereKind = there ? kindOf(there.kind) : 'none';
    const thereAmount = thereKind === 'none' ? null : there?.amount ?? null;
    // Only shelf prices at both compare, as the server's saving counts them.
    const gap =
      amount !== null &&
      thereAmount !== null &&
      onShelf(kind) &&
      onShelf(thereKind)
        ? minor(thereAmount) - minor(amount)
        : 0;
    const size = line.packageNetWeight
      ? formatQuantityWithUnit(line.packageNetWeight, line.packageNetWeightUnit)
      : null;
    return {
      lineId: line.line.id,
      name: line.line.itemName ?? '',
      photoUrl: resolveImageUrl(line.line),
      kind,
      price: amount === null ? null : money(amount),
      product:
        kind === 'similar' && line.product
          ? [line.product.name, size].filter(Boolean).join(' · ')
          : null,
      lastSeen:
        !line.isCurrent && line.observedAt
          ? t('listSavings.lastSeen', {
              date: formatMonthDay(new Date(line.observedAt)),
            })
          : null,
      atListStore: thereAmount === null ? null : money(thereAmount),
      difference:
        gap === 0
          ? null
          : {
              kind: gap > 0 ? 'cheaper' : 'dearer',
              amount: money(Math.abs(gap) / 10 ** decimalPlaces),
            },
    };
  };

  const storeOf = (candidate: Candidate): SavingsStore | null => {
    const option = candidate.store
      ? storeOption(candidate.store)
      : candidate.chain
      ? chainOption(candidate.chain)
      : null;
    if (!option) return null;
    const saving = candidate.savingVsTarget;
    return {
      option,
      isTarget: candidate.isTarget,
      total: candidate.total === null ? null : money(candidate.total),
      saving: !saving
        ? null
        : saving.aboutTheSame
        ? { kind: 'aboutTheSame', coveredLines: saving.coveredLines }
        : {
            kind: saving.amount > 0 ? 'save' : 'more',
            amount: roughly(saving.amount),
            coveredLines: saving.coveredLines,
          },
      standIn: candidate.standIn
        ? t('listSavings.standIn', {
            store: candidate.standIn.store.name,
            distance: formatDistance(
              candidate.standIn.distanceKm,
              readingSystem,
              t,
            ),
          })
        : null,
      lines: candidate.lines.map(line => lineOf(line, candidate.isTarget)),
    };
  };

  return {
    answeredAt: answer.answeredAt,
    stores: answer.candidates.flatMap(candidate => storeOf(candidate) ?? []),
  };
}

/**
 * Could you save? The list at its store and the household's usual stores,
 * line by line. Nothing is asked with Budget & prices off. `cache-first`
 * reads the answer the section stored, so a store's item view asks nothing
 * and opens offline.
 */
export function useListSavings(
  listId: string | undefined,
  fetchPolicy: 'cache-and-network' | 'cache-first' = 'cache-and-network',
) {
  const { t } = useTranslation();
  const readingSystem = useReadingSystem();
  const pricesShown = useBudgetAndPricesEnabled();
  const unavailable = useIsApiUnavailable();
  const { data, loading, error, refetch } = useQuery(
    ListSavingsDocument,
    listId && pricesShown
      ? {
          variables: { listId },
          // Prices move as items are ticked: each open asks again.
          fetchPolicy,
          // A preview: the resync would spend the per-minute budget.
          refetchOn: false,
        }
      : skipToken,
  );
  const asked = !!listId && pricesShown;
  // A failed refresh answers no data: this list's last answer stands. A
  // skipped query keeps its last answer too, which may be another list's.
  const preserved = usePreservedQueryData(
    asked ? data?.shoppingListStoreSavings : undefined,
    undefined,
    listId ?? '',
  );
  const answer = asked ? preserved : undefined;
  return {
    /** Budget & prices is on and there is a list: the comparison is asked for. */
    offered: asked,
    savings: answer ? toListSavings(answer, t, readingSystem) : null,
    loading: loading && !answer,
    /** The request failed or never could: the last answer, if any, stands. */
    failed: !!error || unavailable,
    retry: () => {
      if (asked) void refetch();
    },
  };
}

/** One store's lines, from the answer the section stored; null until read. */
export function useStoreSavingsLines(listId: string, storeKey: string) {
  const { savings, loading, retry } = useListSavings(listId, 'cache-first');
  return {
    store:
      savings?.stores.find(candidate => candidate.option.key === storeKey) ??
      null,
    loading,
    retry,
  };
}
