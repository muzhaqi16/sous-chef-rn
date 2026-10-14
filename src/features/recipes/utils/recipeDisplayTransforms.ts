import type { Translate } from '#/i18n/types';
import { transformRecipeForDisplay } from '#domain/recipeTransform';
import type {
  SearchRecipesResult,
  RecipeSearchResult,
} from '#/services/spoonacular/types';
import type { SearchRecipesQuery } from '#features/recipes/graphql/recipe.generated';
import type { BadgeContent } from '#components/atoms/Badge';

// ── Display item type ──

export interface DisplayItem {
  id: string;
  title: string;
  subtitle: string;
  badge?: BadgeContent;
  imageUrl?: string;
}

export type LocalRecipeNode =
  SearchRecipesQuery['searchRecipes']['edges'][number]['node'];

export type SpoonacularRecipe = SearchRecipesResult | RecipeSearchResult;

/**
 * A search result as it is kept: the row a source returned, with no copy
 * written. The list writes its copy when it renders, so it reads in the
 * language it is shown in, not the one it was fetched in.
 */
export type RecipeSearchRow =
  | { source: 'spoonacular'; recipe: SpoonacularRecipe }
  | {
      source: 'local';
      node: LocalRecipeNode;
      match: SpoonacularRecipe | undefined;
    };

export const spoonacularRows = (
  results: readonly SpoonacularRecipe[],
): RecipeSearchRow[] =>
  results.map((recipe): RecipeSearchRow => ({ source: 'spoonacular', recipe }));

/**
 * Imported recipes carry no time or likes, so `enrichmentFor` lends each row
 * the live Spoonacular values.
 */
export const localRows = (
  nodes: readonly LocalRecipeNode[],
  enrichmentFor: (node: LocalRecipeNode) => SpoonacularRecipe | undefined,
): RecipeSearchRow[] =>
  nodes.map(
    (node): RecipeSearchRow => ({
      source: 'local',
      node,
      match: enrichmentFor(node),
    }),
  );

const spoonacularDisplayItem = (
  recipe: SpoonacularRecipe,
  translate: Translate,
): DisplayItem => {
  const shown = transformRecipeForDisplay(recipe, translate);
  return {
    id: shown.id,
    title: shown.title,
    subtitle: shown.subtitle,
    badge: shown.badge
      ? { text: shown.badge.text, variant: 'primary' }
      : undefined,
    imageUrl: shown.imageUrl,
  };
};

/** Spoonacular's popularity count — `likes` on ingredient-search results,
 * `aggregateLikes` on text-search results. `usedIngredientCount` is the
 * required field that distinguishes the two shapes (same discriminant as
 * recipeTransform). */
function spoonacularLikes(recipe: SpoonacularRecipe): number | undefined {
  return 'usedIngredientCount' in recipe ? recipe.likes : recipe.aggregateLikes;
}

/**
 * A local API recipe node in the Spoonacular subtitle format. The `local-` id
 * prefix keeps it collision-free against `spoonacular-<n>` and routes presses
 * to the backend detail view.
 */
const localDisplayItem = (
  node: LocalRecipeNode,
  match: SpoonacularRecipe | undefined,
  translate: Translate,
): DisplayItem => {
  const matchTime =
    match && 'readyInMinutes' in match ? match.readyInMinutes : undefined;
  const matchLikes = match ? spoonacularLikes(match) : undefined;

  const totalTime = node.totalTimeMinutes ?? matchTime;
  const subtitleParts: string[] = [];
  if (totalTime) {
    subtitleParts.push(`⏱ ${translate('labels.min', { count: totalTime })}`);
  }
  if (node.servings) {
    subtitleParts.push(
      translate('recipes.servingsCount', { count: node.servings }),
    );
  }

  // Saved recipes keep the green "Saved" badge; otherwise borrow the live
  // Spoonacular like count so the row carries the same ❤️ as its twin.
  // Backend search results are the app's recipe corpus, not the user's own,
  // so an unconditional "My recipe" badge would mislabel them.
  const badge: DisplayItem['badge'] = node.isSaved
    ? { text: translate('recipes.savedBadge'), variant: 'success' }
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
};

/** The rows as the list shows them, in the language of the caller's `t`. */
export const toDisplayItems = (
  rows: readonly RecipeSearchRow[],
  translate: Translate,
): DisplayItem[] =>
  rows.map(row =>
    row.source === 'local'
      ? localDisplayItem(row.node, row.match, translate)
      : spoonacularDisplayItem(row.recipe, translate),
  );
