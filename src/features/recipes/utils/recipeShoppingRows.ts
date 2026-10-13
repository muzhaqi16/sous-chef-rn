import { generateEntityId } from '#/utils/generateEntityId';
import { firstNonBlank } from '#/utils/firstNonBlank';
import {
  AddedContext,
  type BatchAddShoppingListItemInput,
} from '#/graphql/generated/schemaTypes';

/** A recipe ingredient, as the recipe detail caches it. */
export interface RecipeIngredientLine {
  id: string;
  name: string;
  quantity: number;
  isOptional: boolean;
  unit?: { id: string; symbol?: string | null; name?: string | null } | null;
  item?: { id: string } | null;
}

export interface RecipeShoppingRow {
  /** The batch entry; `input.id` is the row's client-minted id. */
  input: BatchAddShoppingListItemInput & { id: string };
  recipeIngredientId: string;
  /** What the list shows before the server answers. */
  display: {
    itemName: string;
    quantity: number | null;
    unitName: string | null;
    itemId?: string;
  };
}

interface RowOptions {
  /** The name a line takes when the ingredient carries none. */
  unnamed: string;
  /** A single ingredient the user picked is added even when optional. */
  includeOptional?: boolean;
  mintId?: () => string;
}

/**
 * The shopping-list lines a recipe's ingredients become. The API adds what it
 * is sent: leaving out an optional ingredient ("salt to taste") and naming one
 * that has no catalog item are the device's to decide. Amounts are the recipe's
 * own, which is the whole recipe.
 */
export function recipeShoppingRows(
  recipeId: string,
  ingredients: readonly RecipeIngredientLine[],
  { unnamed, includeOptional = false, mintId = generateEntityId }: RowOptions,
): RecipeShoppingRow[] {
  return ingredients
    .filter(ingredient => includeOptional || !ingredient.isOptional)
    .map(ingredient => {
      const id = mintId();
      const itemName = firstNonBlank(ingredient.name) ?? unnamed;
      const itemId = ingredient.item?.id;
      // An amount of zero states nothing; the API refuses one that is not above it.
      const quantity = ingredient.quantity > 0 ? ingredient.quantity : null;
      const unit = ingredient.unit;
      return {
        recipeIngredientId: ingredient.id,
        display: {
          itemName,
          quantity,
          unitName: firstNonBlank(unit?.symbol, unit?.name) ?? null,
          itemId,
        },
        input: {
          id,
          item: itemId ? { itemId } : { itemName },
          ...(quantity !== null && { quantity }),
          ...(unit && { unit: { id: unit.id } }),
          recipeContext: {
            recipeId,
            recipeIngredientId: ingredient.id,
            addedContext: AddedContext.FromRecipe,
          },
        },
      };
    });
}
