import { skipToken, useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { DietaryAlertState } from '#/graphql/generated/schemaTypes';
import {
  householdCheckOf,
  strictestFirst,
  toHouseholdAlert,
  type HouseholdAlert,
} from '#domain/dietary';
import { RECIPE_INGREDIENTS_PAGE_SIZE } from '#domain/recipeIngredientsPaging';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { useRestrictionsInPlay } from '#features/profile/hooks/useRestrictionsInPlay';
import { useSelectedHomeId, useUser } from '#store/useAppStore';
import { RecipeDietaryAlertsDocument } from './useRecipeDietaryAlerts.generated';

const NO_ALERTS: HouseholdAlert[] = [];

/**
 * The page's summary: each restriction the recipe meets once, at its strongest
 * across the rows, strictest first and a contains before a may-contain.
 */
function summarize(rows: HouseholdAlert[][]): HouseholdAlert[] {
  const strongest = new Map<string, HouseholdAlert>();
  for (const alert of rows.flat()) {
    const held = strongest.get(alert.id);
    if (!held || alert.state === DietaryAlertState.Contains) {
      strongest.set(alert.id, alert);
    }
  }
  return strictestFirst([...strongest.values()]);
}

/**
 * The household's alerts on a recipe: per ingredient row, and the union the
 * page leads with. Read through the persisted cache, so a recipe checked
 * before still shows them offline.
 */
export function useRecipeDietaryAlerts(recipeId: string | undefined) {
  const { t } = useTranslation();
  const homeId = useSelectedHomeId();
  const currentUserId = useUser()?.id;
  const offline = useIsApiUnavailable();
  const restrictionsInPlay = useRestrictionsInPlay(homeId);
  const { data, loading, error } = useQuery(
    RecipeDietaryAlertsDocument,
    recipeId && homeId
      ? {
          variables: {
            recipeId,
            homeId,
            ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
          },
        }
      : skipToken,
  );

  // `skipToken` keeps the last run's answer: with no home it is another's.
  const recipe = recipeId && homeId ? data?.recipe : undefined;
  const byIngredient = new Map<string, HouseholdAlert[]>();
  for (const { node } of recipe?.ingredientsConnection.edges ?? []) {
    if (node.dietaryAlerts.length === 0) continue;
    byIngredient.set(
      node.id,
      node.dietaryAlerts.map(alert =>
        toHouseholdAlert(alert, t, currentUserId),
      ),
    );
  }

  const check = householdCheckOf({
    hasHome: !!homeId && !!recipeId,
    answered: !!recipe,
    offline,
    failed: !!error,
    loading,
  });
  const summary = summarize([...byIngredient.values()]);
  const answered = check === 'checked' || check === 'stale';

  return {
    check,
    summary,
    /** The label caveat: an answered check, unless no restriction can alert. */
    caveat:
      answered && (summary.length > 0 || restrictionsInPlay !== false),
    /** One ingredient row's alerts; none for a row nothing flags. */
    alertsFor: (ingredientId: string) =>
      byIngredient.get(ingredientId) ?? NO_ALERTS,
  };
}
