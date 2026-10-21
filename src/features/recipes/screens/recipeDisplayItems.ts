import type { Translate } from '#/i18n/types';
import type { BadgeContent } from '#components/atoms/Badge';
import {
  catalogHintOf,
  type RecipeTarget,
} from '#features/recipes/hooks/useOpenCatalogRecipe';
import {
  rowKey,
  type FoundHit,
  type FoundRecipe,
  type IngredientMatchEdge,
  type RandomHit,
  type RecipeRow,
  type RecipeSuggestionEdge,
} from '#features/recipes/utils/recipeRows';
import {
  recipeCardBasics,
  timeAndServings,
} from '#features/recipes/utils/recipeCardText';

export interface DisplayItem {
  id: string;
  title: string;
  subtitle: string;
  badge?: BadgeContent;
  imageUrl?: string;
  target: RecipeTarget;
}

/** A card's content; its id is the row's key. */
type CardContent = Omit<DisplayItem, 'id'>;

const recipeTarget = (id: string): RecipeTarget => ({ recipeId: id });

/** A recipe the API holds. Its "Saved" badge is the user's own mark. */
const recipeDisplayItem = (
  recipe: FoundRecipe,
  translate: Translate,
): CardContent => ({
  ...recipeCardBasics(recipe, translate),
  badge: recipe.isSaved
    ? { text: translate('recipes.savedBadge'), variant: 'success' }
    : undefined,
  target: recipeTarget(recipe.id),
});

/** A catalog recipe from search, its popularity as the badge. */
const catalogDisplayItem = (
  hit: FoundHit,
  translate: Translate,
): CardContent => ({
  ...recipeCardBasics(hit, translate),
  badge:
    hit.likes && hit.likes > 0
      ? { text: `❤️ ${hit.likes}`, variant: 'primary' }
      : undefined,
  target: { catalog: catalogHintOf(hit) },
});

function randomDisplayItem(hit: RandomHit, translate: Translate): CardContent {
  return {
    ...recipeCardBasics(hit, translate),
    badge: { text: translate('labels.suggested') },
    target: { catalog: catalogHintOf(hit) },
  };
}

/** What the pantry can make, its badge how much of it the pantry holds. */
function pantryDisplayItem(
  edge: IngredientMatchEdge,
  translate: Translate,
): CardContent {
  const { node: hit, usedIngredientCount, missedIngredientCount } = edge;
  const totalIngredients = usedIngredientCount + missedIngredientCount;
  const subtitleParts: string[] = [];
  if (hit.likes) {
    subtitleParts.push(`❤️ ${hit.likes}`);
  }
  subtitleParts.push(
    ...timeAndServings(hit.totalTimeMinutes, hit.servings, translate),
  );

  return {
    title: hit.name,
    subtitle: subtitleParts.join(' • '),
    badge: {
      text: translate('recipes.pantryMatchLabel', {
        used: usedIngredientCount,
        count: totalIngredients,
        missing: missedIngredientCount,
      }),
      lines: [
        {
          icon: 'checkmark-circle',
          text: String(usedIngredientCount),
          variant: 'success',
        },
        {
          icon: 'cart-outline',
          text: String(missedIngredientCount),
          variant: 'warning',
        },
      ],
    },
    imageUrl: hit.imageUrl ?? undefined,
    target: { catalog: catalogHintOf(hit) },
  };
}

/** A suggestion as its card: the stock it uses up first, its coverage as the badge. */
function suggestionDisplayItem(
  edge: RecipeSuggestionEdge,
  translate: Translate,
): CardContent {
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
    target: recipeTarget(node.id),
  };
}

function cardContent(row: RecipeRow, translate: Translate): CardContent {
  switch (row.source) {
    case 'recipe':
      return recipeDisplayItem(row.recipe, translate);
    case 'catalog':
      return catalogDisplayItem(row.hit, translate);
    case 'random':
      return randomDisplayItem(row.hit, translate);
    case 'pantry':
      return pantryDisplayItem(row.edge, translate);
    case 'suggestion':
      return suggestionDisplayItem(row.edge, translate);
  }
}

/** The rows as the list shows them, in the language of the caller's `t`. */
export const toDisplayItems = (
  rows: readonly RecipeRow[],
  translate: Translate,
): DisplayItem[] =>
  rows.map(row => ({ id: rowKey(row), ...cardContent(row, translate) }));
