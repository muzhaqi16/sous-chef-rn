import { generateEntityId } from '#/utils/generateEntityId';
import {
  AddedContext,
  type BatchAddShoppingListItemInput,
} from '#/graphql/generated/schemaTypes';

/** One planned meal, as `useGenerateShoppingList_mealPlan` caches it. */
export interface PlannedMeal {
  id: string;
  servings?: number | null;
  recipe?: {
    id: string;
    servings?: number | null;
    ingredients: PlannedIngredient[];
  } | null;
}

export interface PlannedIngredient {
  id: string;
  name: string;
  /** Null when the recipe states no amount ("salt, to taste"). */
  quantity: number | null;
  isOptional: boolean;
  unitId?: string | null;
  itemId?: string | null;
}

/** A cached pantry row, reduced to what coverage needs. */
export interface PantryStock {
  itemId?: string | null;
  unitId?: string | null;
  quantity: number;
}

export type SkipReason =
  | 'no-recipe'
  | 'no-ingredients'
  | 'ingredient-not-in-catalog'
  | 'covered-by-pantry';

export interface DerivedShoppingList {
  inputs: BatchAddShoppingListItemInput[];
  /** Minted line id to the ingredient's own wording, for the optimistic row. */
  displayNames: Map<string, string>;
  skipped: Array<{ sourceId: string; reason: SkipReason }>;
  /** False when `checkPantry` was asked for and no pantry rows were cached. */
  pantryChecked: boolean;
}

interface DeriveOptions {
  mealPlanId: string;
  checkPantry: boolean;
  /** Null means the pantry is not in the cache, not that it is empty. */
  pantryRows: PantryStock[] | null;
  mintId?: () => string;
}

interface Source {
  name: string;
  recipeId: string;
  mealPlanItemId: string;
  recipeIngredientId: string;
}

interface Aggregate extends Source {
  itemId: string;
  unitId: string;
  quantity: number;
}

/**
 * The server aggregates on catalog item AND unit, so two units of one item stay
 * two lines and no conversion happens. Same key here, or a derived list and a
 * server-generated one disagree on how many rows the same plan produces.
 */
const keyOf = (itemId: string, unitId: string) => `${itemId}:${unitId}`;

/**
 * Turn a cached meal plan into the shopping-list lines it implies, so the action
 * runs with the API unreachable. An optional ingredient is left out and not
 * reported, as the server does. An unstated amount is wanted once per item, with
 * no quantity, and only when neither the pantry nor a stated line covers it.
 */
export function deriveShoppingListFromMealPlan(
  meals: PlannedMeal[],
  options: DeriveOptions,
): DerivedShoppingList {
  const mint = options.mintId ?? generateEntityId;
  const skipped: DerivedShoppingList['skipped'] = [];
  const aggregated = new Map<string, Aggregate>();
  const unstated = new Map<string, Source>();

  for (const meal of meals) {
    const recipe = meal.recipe;
    if (!recipe) {
      skipped.push({ sourceId: meal.id, reason: 'no-recipe' });
      continue;
    }
    if (recipe.ingredients.length === 0) {
      skipped.push({ sourceId: meal.id, reason: 'no-ingredients' });
      continue;
    }

    // A recipe declaring no servings cannot scale, so the plan's own count is
    // taken as written rather than divided by zero.
    const perRecipe = recipe.servings ?? 0;
    const multiplier = perRecipe > 0 ? (meal.servings ?? 1) / perRecipe : 1;

    for (const ingredient of recipe.ingredients) {
      if (ingredient.isOptional) continue;
      const { itemId, unitId, quantity } = ingredient;
      // Never scaled, summed or converted, so it needs no unit.
      if (quantity === null) {
        if (!itemId) {
          skipped.push({
            sourceId: ingredient.id,
            reason: 'ingredient-not-in-catalog',
          });
        } else if (!unstated.has(itemId)) {
          unstated.set(itemId, {
            name: ingredient.name,
            recipeId: recipe.id,
            mealPlanItemId: meal.id,
            recipeIngredientId: ingredient.id,
          });
        }
        continue;
      }
      // The server drops an ingredient missing either, rather than adding it as
      // free text. Reported here so the caller can name what it left out.
      if (!itemId || !unitId) {
        skipped.push({
          sourceId: ingredient.id,
          reason: 'ingredient-not-in-catalog',
        });
        continue;
      }

      const key = keyOf(itemId, unitId);
      const existing = aggregated.get(key);
      if (existing) {
        existing.quantity += quantity * multiplier;
        continue;
      }
      aggregated.set(key, {
        itemId,
        unitId,
        name: ingredient.name,
        quantity: quantity * multiplier,
        recipeId: recipe.id,
        mealPlanItemId: meal.id,
        recipeIngredientId: ingredient.id,
      });
    }
  }

  const pantryRows = options.checkPantry ? options.pantryRows : [];
  const pantryChecked = pantryRows !== null;
  const inputs: BatchAddShoppingListItemInput[] = [];
  const displayNames = new Map<string, string>();
  const recipeContext = (entry: Source) => ({
    mealPlanId: options.mealPlanId,
    mealPlanItemId: entry.mealPlanItemId,
    addedContext: AddedContext.FromMealPlan,
    recipeId: entry.recipeId,
    recipeIngredientId: entry.recipeIngredientId,
  });
  const statedItemIds = new Set<string>();

  for (const entry of aggregated.values()) {
    statedItemIds.add(entry.itemId);
    const quantity = pantryRows
      ? entry.quantity - stockFor(pantryRows, entry.itemId, entry.unitId)
      : entry.quantity;

    if (quantity <= 0) {
      skipped.push({
        sourceId: entry.recipeIngredientId,
        reason: 'covered-by-pantry',
      });
      continue;
    }

    const lineId = mint();
    displayNames.set(lineId, entry.name);
    inputs.push({
      id: lineId,
      item: { itemId: entry.itemId },
      unit: { id: entry.unitId },
      quantity,
      recipeContext: recipeContext(entry),
    });
  }

  for (const [itemId, entry] of unstated) {
    // A stated line of the item already puts it on the list.
    if (statedItemIds.has(itemId)) continue;
    if (pantryRows && holdsAny(pantryRows, itemId)) {
      skipped.push({
        sourceId: entry.recipeIngredientId,
        reason: 'covered-by-pantry',
      });
      continue;
    }
    const lineId = mint();
    displayNames.set(lineId, entry.name);
    inputs.push({
      id: lineId,
      item: { itemId },
      recipeContext: recipeContext(entry),
    });
  }

  return { inputs, displayNames, skipped, pantryChecked };
}

/** Any stock of the item, in any unit: an unstated amount asks for no more. */
function holdsAny(rows: PantryStock[], itemId: string): boolean {
  return rows.some(row => row.itemId === itemId && row.quantity > 0);
}

/**
 * Rows of the same catalog item in the SAME unit. The server matches the unit's
 * TYPE and converts, which the client cannot do — no selectable field carries a
 * unit's type. Matching the exact unit is a subset of what the server deducts,
 * so a derived list can over-buy but never under-buy.
 */
function stockFor(rows: PantryStock[], itemId: string, unitId: string): number {
  let total = 0;
  for (const row of rows) {
    if (row.itemId === itemId && row.unitId === unitId) total += row.quantity;
  }
  return total;
}
