import type { Translate } from '#/i18n/types';
import type { ExternalSource } from '#/graphql/generated/schemaTypes';

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

/** A catalog recipe's list key, unique across providers. */
export const catalogKey = (hit: {
  provider: ExternalSource;
  providerRecipeId: string;
}): string => `catalog-${hit.provider}-${hit.providerRecipeId}`;
