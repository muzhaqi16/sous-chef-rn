import { useEffect } from 'react';
import { skipToken, useQuery } from '@apollo/client/react';
import {
  GetPantryItemSuggestionsDocument,
  type GetPantryItemSuggestionsQuery,
} from '#features/pantry/graphql/pantry.generated';
import { resolveImageUrl } from '#utils/imageUtils';
import { preloadImages } from '#components/atoms/CachedImage';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useDataState } from '#hooks/data/useDataState';
import { errorService } from '#/services/errorService';
import type { SuggestionsHookResult } from '#features/catalog/ui/AddItemSheet/types';
import { useToday } from '#hooks/useToday';
import { useTranslation } from '#/i18n';
import type { Translate } from '#/i18n/types';
import { expiryLabel } from '#domain/expiry';
import {
  formatQuantityDisplay,
  getUnitDisplayText,
} from '#utils/formatQuantity';

/**
 * Per-section limit. The sheet shows a small preview of each section that drills
 * into the full list, so this backs the drill-down without a second round-trip.
 */
export const PANTRY_SUGGESTIONS_LIMIT = 20;

type Sections = NonNullable<
  GetPantryItemSuggestionsQuery['pantry']
>['suggestions'];
type SuggestionRow = Sections['popular'][number];
type PantryItemSuggestion = SuggestionRow & { subtitle: string | null };

/** How much a low-stock stack holds, when the row can name its unit. */
const amountLeft = (row: Sections['lowStock'][number], t: Translate) => {
  const { currentQuantity, defaultUnit } = row;
  // On a held-stack row the API's `defaultUnit` is the item's default, which
  // need not be the stack's own unit (`defaultUnitId`).
  if (currentQuantity === null || defaultUnit?.id !== row.defaultUnitId) {
    return null;
  }
  return t('addToPantry.amountLeft', {
    count: currentQuantity,
    amount: formatQuantityDisplay(
      currentQuantity,
      getUnitDisplayText(defaultUnit),
    ),
  });
};

interface UsePantryItemSuggestionsOptions {
  pantryId: string | undefined;
  limit?: number;
  skip?: boolean;
}

export function usePantryItemSuggestions({
  pantryId,
  limit = PANTRY_SUGGESTIONS_LIMIT,
  skip = false,
}: UsePantryItemSuggestionsOptions): SuggestionsHookResult<PantryItemSuggestion> {
  const { t } = useTranslation();
  const today = useToday();
  const skipped = skip || !pantryId;

  // Not skipped offline: `offlineModeLink` serves a cached read and answers a
  // miss with an error, which `useDataState` classifies as offline.
  const { data, loading, error, refetch } = useQuery(
    GetPantryItemSuggestionsDocument,
    skipped ? skipToken : { variables: { pantryId, limit, today } },
  );

  useApolloErrorLogger(GetPantryItemSuggestionsDocument, error);

  // The resolved image URL the rows render, and the context line a section
  // shows in place of the category.
  const toRow = (
    row: SuggestionRow,
    subtitle: string | null = null,
  ): PantryItemSuggestion => ({
    ...row,
    imageUrl: resolveImageUrl(row),
    subtitle,
  });

  const sections = data?.pantry?.suggestions;
  const grouped = {
    lowStock: (sections?.lowStock ?? []).map(row =>
      toRow(row, amountLeft(row, t)),
    ),
    expiringSoon: (sections?.expiringSoon ?? []).map(row =>
      toRow(
        row,
        row.daysUntilExpiry === null
          ? null
          : expiryLabel(row.daysUntilExpiry, t),
      ),
    ),
    recentlyDeleted: (sections?.recentlyDeleted ?? []).map(row => toRow(row)),
    frequentlyAdded: (sections?.frequentlyAdded ?? []).map(row => toRow(row)),
    popular: (sections?.popular ?? []).map(row => toRow(row)),
  };

  // Preload suggestion images into disk cache for instant display. Keyed on the
  // Apollo result, which only changes when the data does — the derived arrays
  // above are rebuilt on every render.
  useEffect(() => {
    if (!sections) return;
    const urls = [
      ...sections.lowStock,
      ...sections.expiringSoon,
      ...sections.recentlyDeleted,
      ...sections.frequentlyAdded,
      ...sections.popular,
    ]
      .map(s => resolveImageUrl(s))
      .filter((url): url is string => !!url);
    if (urls.length > 0) {
      preloadImages(urls);
    }
  }, [sections]);

  const state = useDataState({
    loading,
    error,
    hasResult: data !== undefined,
    isEmpty: Object.values(grouped).every(items => items.length === 0),
    skipped,
  });

  return {
    grouped,
    state,
    refetch: () => {
      void refetch().catch(refetchError =>
        errorService.reportError(refetchError, {
          operation: 'usePantryItemSuggestions.refetch',
        }),
      );
    },
  };
}

export type { PantryItemSuggestion };
