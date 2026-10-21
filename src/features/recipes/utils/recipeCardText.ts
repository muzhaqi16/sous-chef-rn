import type { Translate } from '#/i18n/types';

/** "⏱ 25 min", "4 servings": the time only when it is known. */
export function timeAndServings(
  totalTimeMinutes: number | null | undefined,
  servings: number,
  translate: Translate,
): string[] {
  const parts: string[] = [];
  if (totalTimeMinutes) {
    parts.push(`⏱ ${translate('labels.min', { count: totalTimeMinutes })}`);
  }
  parts.push(translate('recipes.servingsCount', { count: servings }));
  return parts;
}

interface CardRecipe {
  name: string;
  totalTimeMinutes?: number | null;
  servings: number;
  imageUrl?: string | null;
}

/** A card's title, "⏱ 25 min • 4 servings" line and image. */
export function recipeCardBasics(
  recipe: CardRecipe,
  translate: Translate,
): { title: string; subtitle: string; imageUrl: string | undefined } {
  return {
    title: recipe.name,
    subtitle: timeAndServings(
      recipe.totalTimeMinutes,
      recipe.servings,
      translate,
    ).join(' • '),
    imageUrl: recipe.imageUrl ?? undefined,
  };
}
