import {
  ExternalSource,
  type CreateRecipeInput,
} from '#/graphql/generated/schemaTypes';
import {
  RecipeInformation,
  type RecipePriceBreakdown,
} from '#/services/spoonacular/types';
import { stripPriceFromName } from '#features/recipes/utils/stripPriceFromName';

/** Ingredient names are matched case- and whitespace-insensitively. */
const normalizeName = (name: string): string => name.trim().toLowerCase();

/**
 * A Spoonacular recipe as this app's `CreateRecipeInput`. Pure: it reads only
 * what the fetch already returned, which is what lets the mirror carry
 * per-ingredient nutrition without a second Spoonacular call.
 */
export const toRecipeInput = (
  spoonacularRecipe: RecipeInformation,
  priceBreakdown?: RecipePriceBreakdown | null,
) => {
  // Extract calories from nutrition data
  const caloriesPerServing = spoonacularRecipe.nutrition?.nutrients?.find(
    n => n.name === 'Calories',
  )?.amount;

  // Transform instructions to JSON format (matches user-created format: { step, text })
  const instructions =
    spoonacularRecipe.analyzedInstructions?.[0]?.steps?.map(step => ({
      step: step.number,
      text: step.step,
    })) || [];

  // Per-ingredient nutrition is already present in the recipe response when
  // it's fetched with `includeNutrition: true` (see useRecipeData) — index it
  // by Spoonacular ingredient id so the mirror can carry it with ZERO extra
  // Spoonacular calls. The rich /food/ingredients/{id}/information endpoint
  // (cost/possibleUnits/categoryPath) is intentionally not called — N calls
  // per recipe would blow the API quota; the server owns those fields.
  const nutritionByIngredientId = new Map(
    (spoonacularRecipe.nutrition?.ingredients ?? []).map(
      (n): [number, typeof n] => [n.id, n],
    ),
  );

  // Per-ingredient estimated cost (US cents) from the recipe-scoped
  // priceBreakdown — only present on deliberate saves. priceBreakdown
  // identifies ingredients by NAME (no id), so match on normalized name only.
  // An unmatched ingredient simply gets no cost — never a guessed/positional
  // one, which could assign the wrong ingredient's price.
  const costByName = new Map(
    (priceBreakdown?.ingredients ?? []).map((c): [string, number] => [
      normalizeName(c.name),
      c.price,
    ]),
  );

  return {
    // Basic recipe info
    name: spoonacularRecipe.title,
    description: spoonacularRecipe.summary?.replace(/<[^>]*>/g, ''),
    instructions,

    // Structured attributes — the API rejects flat servings/cuisine/time/
    // nutrition/image fields; each lives under its typed sub-input.
    metadata: {
      servings: spoonacularRecipe.servings,
      cuisine: spoonacularRecipe.cuisines?.length
        ? spoonacularRecipe.cuisines.join(', ')
        : undefined,
    },
    // Spoonacular usually omits the prep/cook breakdown but always provides
    // readyInMinutes — persist it as the total time so the imported recipe
    // carries a time of its own (otherwise it shows servings only).
    timing: {
      prepTimeMinutes: spoonacularRecipe.preparationMinutes || undefined,
      cookTimeMinutes: spoonacularRecipe.cookingMinutes || undefined,
      totalTimeMinutes: spoonacularRecipe.readyInMinutes || undefined,
    },
    nutrition: {
      caloriesPerServing: caloriesPerServing
        ? Math.round(caloriesPerServing)
        : undefined,
    },
    media: { imageUrl: spoonacularRecipe.image },

    // Attribution - original recipe source
    attribution: {
      source: spoonacularRecipe.sourceName,
      sourceUrl: spoonacularRecipe.sourceUrl,
    },

    // External source fields
    source: ExternalSource.Spoonacular,
    externalSourceId: String(spoonacularRecipe.id),
    externalSourceUrl: spoonacularRecipe.sourceUrl,
    externalSourceData: spoonacularRecipe,

    // Transform ingredients for backend
    ingredients:
      spoonacularRecipe.extendedIngredients?.map((ing, idx) => {
        const ingredientNutrition = nutritionByIngredientId.get(ing.id);
        const costCents = costByName.get(normalizeName(ing.name));
        return {
          // Sanitize at the API boundary — the API stores names verbatim, so a
          // price must never ride in on the name (it belongs in estimatedPrice).
          name: stripPriceFromName(ing.name),
          quantity: ing.amount || 0,
          originalString: ing.original,
          sortOrder: idx,
          // Typed, loss-free Spoonacular mirror — replaces the deprecated flat
          // spoonacular* fields. The server caches this payload verbatim,
          // extracts nutrition/cost/units/image/aisle into the catalog, and
          // links the ingredient to an Item asynchronously (fill-if-null).
          // See sous-chef-api docs/architecture/external-ingredient-mirror.md.
          externalSources: [
            {
              source: ExternalSource.Spoonacular,
              externalId: String(ing.id),
              isPrimary: true,
              spoonacular: {
                id: ing.id,
                // Verbatim upstream name — the mirror is loss-free; only the
                // top-level canonical `name` above is price-stripped.
                name: ing.name,
                nameClean: ing.nameClean,
                original: ing.original,
                originalName: ing.originalName,
                amount: ing.amount,
                unit: ing.unit,
                unitShort: ing.measures?.us?.unitShort,
                unitLong: ing.measures?.us?.unitLong,
                consistency: ing.consistency,
                aisle: ing.aisle,
                // Filename only — the server builds the CDN URL and
                // internalizes the image to our storage so it renders offline.
                image: ing.image,
                meta: ing.meta,
                measures: {
                  us: {
                    amount: ing.measures?.us?.amount,
                    unitShort: ing.measures?.us?.unitShort,
                    unitLong: ing.measures?.us?.unitLong,
                  },
                  metric: {
                    amount: ing.measures?.metric?.amount,
                    unitShort: ing.measures?.metric?.unitShort,
                    unitLong: ing.measures?.metric?.unitLong,
                  },
                },
                // Only `nutrients` is per-ingredient; properties/flavonoids/
                // caloricBreakdown/weightPerServing are recipe-level and stay
                // omitted. Absent when the recipe wasn't fetched with
                // nutrition or the ingredient has no match.
                nutrition: ingredientNutrition
                  ? {
                      nutrients: ingredientNutrition.nutrients.map(n => ({
                        name: n.name,
                        amount: n.amount,
                        unit: n.unit,
                        percentOfDailyNeeds: n.percentOfDailyNeeds,
                      })),
                    }
                  : undefined,
                // Estimated cost (US cents) — the server stores it as the
                // estimate on the catalog item's price history. Absent unless
                // priceBreakdown was fetched (deliberate saves only).
                estimatedCost:
                  costCents != null
                    ? { value: costCents, unit: 'US Cents' }
                    : undefined,
              },
            },
          ],
        };
      }) || [],
  } satisfies CreateRecipeInput;
};

/**
 * Fire-and-forget find-or-create when the user views an external recipe.
 * Attempts once per recipe.
 */
