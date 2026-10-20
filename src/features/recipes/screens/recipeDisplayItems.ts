import type { Translate } from '#/i18n/types';
import { transformRecipeForDisplay } from '#domain/recipeTransform';
import type {
  RecipeInformation,
  RecipeSearchResult,
} from '#/services/spoonacular/types';
import type { BadgeContent } from '#components/atoms/Badge';
import type {
  LocalRecipeNode,
  RecipeRow,
  RecipeSuggestionEdge,
  SpoonacularRecipe,
} from '#features/recipes/utils/recipeRows';

export interface DisplayItem {
  id: string;
  title: string;
  subtitle: string;
  badge?: BadgeContent;
  imageUrl?: string;
}

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

/** Spoonacular's popularity: `likes` on ingredient-search results,
 * `aggregateLikes` on text-search ones, told apart by the required
 * `usedIngredientCount` (as in recipeTransform). */
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

  // A saved recipe keeps its "Saved" badge, else borrows its Spoonacular twin's
  // like count. Backend results are the app's corpus, not the user's, so no "My
  // recipe" badge.
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

/** A suggestion as its card: the stock it uses up first, its coverage as the badge. */
function suggestionDisplayItem(
  edge: RecipeSuggestionEdge,
  translate: Translate,
): DisplayItem {
  const { node, coverage } = edge;
  // One name per item: two stacks of milk are still "Uses milk".
  const named = new Set<string>();
  const expiring = edge.expiringStacks
    .map(stack => stack.itemName.trim())
    .filter(name => {
      const key = name.toLocaleLowerCase();
      if (name === '' || named.has(key)) return false;
      named.add(key);
      return true;
    });
  const subtitleParts: string[] = [];
  if (expiring.length > 0) {
    subtitleParts.push(
      translate('recipes.usesExpiringSoon', {
        names: expiring.join(', '),
        count: expiring.length,
      }),
    );
  }
  subtitleParts.push(
    translate('recipes.servingsCount', { count: node.servings }),
  );
  if (node.totalTimeMinutes) {
    subtitleParts.push(
      translate('labels.min', { count: node.totalTimeMinutes }),
    );
  }

  return {
    // Opens the recipe itself, as the local rows of a search do.
    id: `local-${node.id}`,
    title: node.name,
    subtitle: subtitleParts.join(' • '),
    badge: {
      text: translate('recipes.pantryCoverage', { percent: coverage }),
      lines: [
        {
          icon: 'checkmark-circle',
          text: translate('recipes.coveragePercent', { percent: coverage }),
          variant: 'success',
        },
      ],
    },
    imageUrl: node.imageUrl ?? undefined,
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
      case 'suggestion':
        return suggestionDisplayItem(row.edge, translate);
    }
  });
