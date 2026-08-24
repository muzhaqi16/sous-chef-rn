import { t as tGlobal } from '#/i18n';
import { transformRecipeForDisplay } from '#/utils/recipeTransform';
import type {
  SearchRecipesResult,
  RecipeSearchResult,
} from '#/services/recipeApi/types';
import type { SearchRecipesQuery } from '#features/recipes/graphql/recipe.generated';

// ── Display item type ──

export interface DisplayItem {
  id: string;
  title: string;
  subtitle: string;
  badge?: {
    text: string;
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  };
  imageUrl?: string;
}

export type LocalRecipeNode =
  SearchRecipesQuery['searchRecipes']['edges'][number]['node'];

export type SpoonacularRecipe = SearchRecipesResult | RecipeSearchResult;

/** Transform Spoonacular search results into display items */
export function toSpoonacularDisplayItems(
  results: (SearchRecipesResult | RecipeSearchResult)[],
): DisplayItem[] {
  return results.map(recipe => {
    const t = transformRecipeForDisplay(recipe);
    return {
      id: t.id,
      title: t.title,
      subtitle: t.subtitle,
      badge: t.badge
        ? ({
            text: t.badge.text,
            variant: 'primary',
          } satisfies DisplayItem['badge'])
        : undefined,
      imageUrl: t.imageUrl,
    };
  });
}

/** Spoonacular's popularity count — `likes` on ingredient-search results,
 * `aggregateLikes` on text-search results. `usedIngredientCount` is the
 * required field that distinguishes the two shapes (same discriminant as
 * recipeTransform). */
function spoonacularLikes(recipe: SpoonacularRecipe): number | undefined {
  return 'usedIngredientCount' in recipe ? recipe.likes : recipe.aggregateLikes;
}

/** Transform local API recipe nodes into display items, mirroring the
 * Spoonacular subtitle format. The `local-` id prefix keeps these
 * collision-free against `spoonacular-<n>` ids and lets the press handler
 * route to the backend recipe detail view.
 *
 * Backend (imported) recipes are missing time/likes — the import only stores
 * Spoonacular's prep/cook breakdown (usually empty) and keeps the like count
 * inside an opaque JSON blob. `enrichmentFor` supplies the matching live
 * Spoonacular result so the row can borrow its `readyInMinutes` + like count
 * and look identical to a native Spoonacular row. */
export function toLocalDisplayItems(
  nodes: LocalRecipeNode[],
  enrichmentFor: (node: LocalRecipeNode) => SpoonacularRecipe | undefined,
): DisplayItem[] {
  return nodes.map(node => {
    const match = enrichmentFor(node);
    const matchTime =
      match && 'readyInMinutes' in match ? match.readyInMinutes : undefined;
    const matchLikes = match ? spoonacularLikes(match) : undefined;

    const totalTime = node.totalTimeMinutes ?? matchTime;
    const subtitleParts: string[] = [];
    if (totalTime) {
      subtitleParts.push(`⏱ ${tGlobal('labels.min', { count: totalTime })}`);
    }
    if (node.servings) {
      subtitleParts.push(
        tGlobal('recipes.servingsCount', { count: node.servings }),
      );
    }

    // Saved recipes keep the green "Saved" badge; otherwise borrow the live
    // Spoonacular like count so the row carries the same ❤️ as its twin.
    // Backend search results are the app's recipe corpus, not the user's own,
    // so an unconditional "My recipe" badge would mislabel them.
    const badge: DisplayItem['badge'] = node.isSaved
      ? { text: tGlobal('recipes.savedBadge'), variant: 'success' }
      : matchLikes && matchLikes > 0
      ? { text: `❤️ ${matchLikes}`, variant: 'primary' }
      : undefined;

    return {
      id: `local-${node.id}`,
      title: node.name,
      subtitle: subtitleParts.join(' • '),
      badge,
      imageUrl: node.imageUrl ?? undefined,
    };
  });
}
