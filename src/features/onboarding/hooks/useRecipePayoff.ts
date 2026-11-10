import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useSelectedHomeId } from '#store/useAppStore';
import { useServerRecipeSuggestions } from '#features/recipes/hooks/useServerRecipeSuggestions';
import { useRestrictionsInPlay } from '#features/profile/hooks/useRestrictionsInPlay';
import { suggestionTier } from '#domain/recipeCoverage';

const PAYOFF_COUNT = 3;

/**
 * Up to three recipes for the pantry just stocked, screened on the server for
 * the user's restrictions and those their home shares. Ready ones lead, then
 * those that use something held. When nothing uses the stock, the server's
 * popular picks show instead, untiered; with nothing stocked, none show.
 * Screening reads recipe data only, so the label caveat shows whenever a
 * restriction may apply.
 */
export function useRecipePayoff({ hasStock }: { hasStock: boolean }) {
  const suggestionsOn = useFeatureFlag('pantrySuggestions');
  const restrictionsInPlay = useRestrictionsInPlay(useSelectedHomeId());
  const { rows } = useServerRecipeSuggestions(suggestionsOn);

  const suggestions = rows.flatMap(row =>
    row.source === 'suggestion'
      ? [
          {
            row,
            tier: suggestionTier({
              coverage: row.edge.coverage,
              missingIngredientCount: row.edge.missingIngredientCount,
              usedIngredientCount: row.edge.usedIngredients.length,
            }),
          },
        ]
      : [],
  );
  const pantryRows = [
    ...suggestions.filter(({ tier }) => tier === 'ready'),
    ...suggestions.filter(({ tier }) => tier === 'almost'),
  ].map(({ row }) => row);
  // With nothing used, the server ranks the screened set by popularity.
  const popular = pantryRows.length === 0 && hasStock;

  return {
    rows: (popular ? suggestions.map(({ row }) => row) : pantryRows).slice(
      0,
      PAYOFF_COUNT,
    ),
    /** The rows are popular picks, not matches for the pantry. */
    popular,
    showCheckLabel: restrictionsInPlay !== false,
  };
}
