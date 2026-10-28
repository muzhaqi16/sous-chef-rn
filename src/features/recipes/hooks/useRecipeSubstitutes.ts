import { skipToken, useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { toHouseholdAlert, type HouseholdAlert } from '#domain/dietary';
import { RECIPE_INGREDIENTS_PAGE_SIZE } from '#domain/recipeIngredientsPaging';
import { formatQuantityWithUnit } from '#/utils/formatQuantity';
import {
  useSelectedHomeId,
  useSelectedPantryId,
  useUser,
} from '#store/useAppStore';
import { RecipeSubstitutesDocument } from './useRecipeSubstitutes.generated';

/** One swap for an ingredient, worded for the sheet. */
export interface SubstituteOption {
  id: string;
  /** Each part in the amount the recipe needs, and whether the pantry holds it. */
  parts: { key: string; text: string; inPantry: boolean }[];
  /** How much of the pantry holds the parts. */
  stock: 'all' | 'some' | 'none';
  /** The amount of the ingredient the parts are for, when not the recipe's. */
  per: string | null;
  /** How the swap changes the dish, as curated. */
  note: string | null;
  /** The household's preference and goal notes the parts raise. */
  alerts: HouseholdAlert[];
}

const NO_OPTIONS: SubstituteOption[] = [];

/**
 * What can stand in for each of a recipe's ingredients, read only when
 * `wanted`: the page offers swaps on the rows the household flags.
 */
export function useRecipeSubstitutes(
  recipeId: string | undefined,
  wanted: boolean,
) {
  const { t } = useTranslation();
  const homeId = useSelectedHomeId();
  const pantryId = useSelectedPantryId();
  const currentUserId = useUser()?.id;
  const { data } = useQuery(
    RecipeSubstitutesDocument,
    recipeId && homeId && wanted
      ? {
          variables: {
            recipeId,
            homeId,
            pantryId,
            ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
          },
        }
      : skipToken,
  );

  // `skipToken` keeps the last answer: the home just left, or rows unflagged.
  const recipe = recipeId && homeId && wanted ? data?.recipe : undefined;
  const byIngredient = new Map<string, SubstituteOption[]>();
  for (const { node } of recipe?.ingredientsConnection.edges ?? []) {
    if (node.substitutes.length === 0) continue;
    byIngredient.set(
      node.id,
      node.substitutes.map(({ substitute, scaled, parts, alerts }) => {
        const held = parts.filter(part => part.inPantry).length;
        return {
          id: substitute.id,
          parts: parts.map(part => ({
            key: part.item.id,
            text: t('recipes.substitutes.part', {
              amount: formatQuantityWithUnit(part.quantity, part.unit),
              name: part.item.name,
            }),
            inPantry: part.inPantry,
          })),
          stock: held === parts.length ? 'all' : held > 0 ? 'some' : 'none',
          per: scaled
            ? null
            : formatQuantityWithUnit(
                substitute.forQuantity,
                substitute.forUnit,
              ),
          note: substitute.note,
          alerts: alerts.map(alert =>
            toHouseholdAlert(alert, t, currentUserId),
          ),
        };
      }),
    );
  }

  return {
    /** One ingredient's swaps, those the pantry holds first; none when none is known. */
    substitutesFor: (ingredientId: string) =>
      byIngredient.get(ingredientId) ?? NO_OPTIONS,
  };
}
