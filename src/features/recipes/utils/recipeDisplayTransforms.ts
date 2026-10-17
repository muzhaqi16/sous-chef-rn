import type { Translate } from '#/i18n/types';
import { transformRecipeForDisplay } from '#domain/recipeTransform';
import type {
  RecipeInformation,
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
 * A search result or suggestion as it is kept: the row a source returned, with
 * no copy written. The list writes its copy when it renders, so it reads in the
 * language it is shown in, not the one it was fetched in.
 */
export type RecipeRow =
  | { source: 'spoonacular'; recipe: SpoonacularRecipe }
  | {
      source: 'local';
      node: LocalRecipeNode;
      match: SpoonacularRecipe | undefined;
    }
  /** A suggestion for an empty pantry. */
  | { source: 'random'; recipe: RecipeInformation }
  /** A suggestion the pantry can make, with its cook time once enriched. */
  | {
      source: 'pantry';
      recipe: RecipeSearchResult;
      info: RecipeInformation | undefined;
    };

export const spoonacularRows = (
  results: readonly SpoonacularRecipe[],
): RecipeRow[] =>
  results.map((recipe): RecipeRow => ({ source: 'spoonacular', recipe }));

/**
 * Imported recipes carry no time or likes, so `enrichmentFor` lends each row
 * the live Spoonacular values.
 */
export const localRows = (
  nodes: readonly LocalRecipeNode[],
  enrichmentFor: (node: LocalRecipeNode) => SpoonacularRecipe | undefined,
): RecipeRow[] =>
  nodes.map(
    (node): RecipeRow => ({
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

function randomDisplayItem(
  recipe: RecipeInformation,
  translate: Translate,
): DisplayItem {
  const subtitleParts: string[] = [];
  if (recipe.servings) {
    subtitleParts.push(
      translate('recipes.servingsCount', { count: recipe.servings }),
    );
  }
  const totalTime =
    recipe.readyInMinutes || recipe.preparationMinutes || recipe.cookingMinutes;
  if (totalTime) {
    subtitleParts.push(translate('labels.min', { count: totalTime }));
  }

  return {
    id: String(recipe.id),
    title: recipe.title,
    subtitle: subtitleParts.join(' \u2022 '),
    badge: { text: translate('labels.suggested') },
    imageUrl: recipe.image,
  };
}

function pantryDisplayItem(
  recipe: RecipeSearchResult,
  info: RecipeInformation | undefined,
  translate: Translate,
): DisplayItem {
  const totalIngredients =
    recipe.usedIngredientCount + recipe.missedIngredientCount;

  const subtitleParts: string[] = [];
  if (recipe.likes) {
    subtitleParts.push(`❤️ ${recipe.likes}`);
  }
  if (info?.servings) {
    subtitleParts.push(
      translate('recipes.servingsCount', { count: info.servings }),
    );
  }
  // Spoonacular reports an unknown duration as 0, so a zero falls through.
  const totalTime = [
    info?.readyInMinutes,
    info?.preparationMinutes,
    info?.cookingMinutes,
  ].find(minutes => minutes !== undefined && minutes !== 0);
  if (totalTime) {
    subtitleParts.push(translate('labels.min', { count: totalTime }));
  }

  return {
    id: String(recipe.id),
    title: recipe.title,
    subtitle:
      subtitleParts.join(' • ') ||
      translate('recipes.ingredientCount', { count: totalIngredients }),
    badge: {
      text: translate('recipes.pantryMatchLabel', {
        used: recipe.usedIngredientCount,
        count: totalIngredients,
        missing: recipe.missedIngredientCount,
      }),
      lines: [
        {
          icon: 'checkmark-circle',
          text: String(recipe.usedIngredientCount),
          variant: 'success',
        },
        {
          icon: 'cart-outline',
          text: String(recipe.missedIngredientCount),
          variant: 'warning',
        },
      ],
    },
    imageUrl: recipe.image,
  };
}

/** The rows as the list shows them, in the language of the caller's `t`. */
export const toDisplayItems = (
  rows: readonly RecipeRow[],
  translate: Translate,
): DisplayItem[] =>
  rows.map(row => {
    switch (row.source) {
      case 'local':
        return localDisplayItem(row.node, row.match, translate);
      case 'spoonacular':
        return spoonacularDisplayItem(row.recipe, translate);
      case 'random':
        return randomDisplayItem(row.recipe, translate);
      case 'pantry':
        return pantryDisplayItem(row.recipe, row.info, translate);
    }
  });
