import type { SupportedLanguage } from './config';

/*
 * Feature-owned copy, merged into the core tree at init.
 *
 * ## Why the imports are here and not behind the feature registry
 *
 * `src/i18n/config.ts` is imported near the top of `index.js`, before anything
 * else that can call `t()`. Reaching for `#features/registry` to collect these
 * would pull in every manifest, and through them every tab stack and every
 * screen — the whole component graph — into the launch path. These are JSON
 * imports: data, no components, no cost beyond the strings themselves.
 *
 * ## Adding a feature
 *
 * Add `src/features/<name>/locales/{en,es,it,sq}.json` and one entry below.
 * `scripts/check-i18n.mjs` walks this file, so a locale missing from a feature
 * fails there rather than at runtime in that language.
 */
import pantryEn from '#features/pantry/locales/en.json';
import pantryEs from '#features/pantry/locales/es.json';
import pantryIt from '#features/pantry/locales/it.json';
import pantrySq from '#features/pantry/locales/sq.json';
import shoppingListEn from '#features/shoppingList/locales/en.json';
import shoppingListEs from '#features/shoppingList/locales/es.json';
import shoppingListIt from '#features/shoppingList/locales/it.json';
import shoppingListSq from '#features/shoppingList/locales/sq.json';
import recipesEn from '#features/recipes/locales/en.json';
import recipesEs from '#features/recipes/locales/es.json';
import recipesIt from '#features/recipes/locales/it.json';
import recipesSq from '#features/recipes/locales/sq.json';
import mealPlanEn from '#features/mealPlan/locales/en.json';
import mealPlanEs from '#features/mealPlan/locales/es.json';
import mealPlanIt from '#features/mealPlan/locales/it.json';
import mealPlanSq from '#features/mealPlan/locales/sq.json';
import catalogEn from '#features/catalog/locales/en.json';
import catalogEs from '#features/catalog/locales/es.json';
import catalogIt from '#features/catalog/locales/it.json';
import catalogSq from '#features/catalog/locales/sq.json';
import profileEn from '#features/profile/locales/en.json';
import profileEs from '#features/profile/locales/es.json';
import profileIt from '#features/profile/locales/it.json';
import profileSq from '#features/profile/locales/sq.json';
import homeEn from '#features/home/locales/en.json';
import homeEs from '#features/home/locales/es.json';
import homeIt from '#features/home/locales/it.json';
import homeSq from '#features/home/locales/sq.json';
import notificationsEn from '#features/notifications/locales/en.json';
import notificationsEs from '#features/notifications/locales/es.json';
import notificationsIt from '#features/notifications/locales/it.json';
import notificationsSq from '#features/notifications/locales/sq.json';
import barcodeEn from '#features/barcode/locales/en.json';
import barcodeEs from '#features/barcode/locales/es.json';
import barcodeIt from '#features/barcode/locales/it.json';
import barcodeSq from '#features/barcode/locales/sq.json';

type LocaleTree = Record<string, unknown>;

export const FEATURE_LOCALES: Record<
  string,
  Record<SupportedLanguage, LocaleTree>
> = {
  pantry: { en: pantryEn, es: pantryEs, it: pantryIt, sq: pantrySq },
  shoppingList: {
    en: shoppingListEn,
    es: shoppingListEs,
    it: shoppingListIt,
    sq: shoppingListSq,
  },
  recipes: { en: recipesEn, es: recipesEs, it: recipesIt, sq: recipesSq },
  mealPlan: { en: mealPlanEn, es: mealPlanEs, it: mealPlanIt, sq: mealPlanSq },
  catalog: { en: catalogEn, es: catalogEs, it: catalogIt, sq: catalogSq },
  profile: { en: profileEn, es: profileEs, it: profileIt, sq: profileSq },
  home: { en: homeEn, es: homeEs, it: homeIt, sq: homeSq },
  notifications: {
    en: notificationsEn,
    es: notificationsEs,
    it: notificationsIt,
    sq: notificationsSq,
  },
  barcode: { en: barcodeEn, es: barcodeEs, it: barcodeIt, sq: barcodeSq },
};

/** Core copy plus every feature's, for one locale. */
export const mergeFeatureLocales = (
  locale: SupportedLanguage,
  core: LocaleTree,
): LocaleTree => {
  const merged: LocaleTree = { ...core };
  for (const byLocale of Object.values(FEATURE_LOCALES)) {
    Object.assign(merged, byLocale[locale]);
  }
  return merged;
};
