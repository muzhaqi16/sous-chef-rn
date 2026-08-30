import type { SupportedLanguage } from './config';

/*
 * Feature-owned copy, merged at init. Imported DIRECTLY, not via
 * `#features/registry` — that pulls the whole component graph into the launch
 * path. A feature needs its JSON files AND an entry below: the gates read the
 * filesystem, the app reads this map, so a missing entry renders raw keys.
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

/**
 * Merge locale trees by COMBINING namespaces. A shallow `Object.assign` would
 * let a feature declaring `labels` or `errors` replace core's subtree wholesale,
 * silently taking every key in it. Arrays and scalars are replaced, not merged:
 * a locale value is a namespace or a string, never something to concatenate.
 */
const deepMergeLocale = (
  base: LocaleTree,
  incoming: LocaleTree,
): LocaleTree => {
  const merged: LocaleTree = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    const existing = merged[key];
    const bothAreNamespaces = isNamespace(existing) && isNamespace(value);
    merged[key] = bothAreNamespaces ? deepMergeLocale(existing, value) : value;
  }
  return merged;
};

const isNamespace = (value: unknown): value is LocaleTree =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Core copy plus every feature's, for one locale. */
export const mergeFeatureLocales = (
  locale: SupportedLanguage,
  core: LocaleTree,
): LocaleTree => {
  let merged: LocaleTree = { ...core };
  for (const byLocale of Object.values(FEATURE_LOCALES)) {
    merged = deepMergeLocale(merged, byLocale[locale]);
  }
  return merged;
};
