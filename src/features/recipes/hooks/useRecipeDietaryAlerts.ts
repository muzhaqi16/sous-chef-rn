import { skipToken, useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  householdCheckOf,
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
 * The household's alerts on a recipe, per ingredient row. Read through the
 * persisted cache, so a recipe checked before still shows them offline.
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

  return {
    check,
    /** Some ingredient row is flagged. */
    flagged: byIngredient.size > 0,
    /** Unsure counts as yes: only a known absence of restrictions is no. */
    restrictionsApply: restrictionsInPlay !== false,
    /** One ingredient row's alerts; none for a row nothing flags. */
    alertsFor: (ingredientId: string) =>
      byIngredient.get(ingredientId) ?? NO_ALERTS,
  };
}
