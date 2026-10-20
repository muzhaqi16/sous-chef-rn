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
