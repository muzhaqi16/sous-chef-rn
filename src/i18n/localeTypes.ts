/**
 * The English copy as a TYPE: core plus every feature's namespaces, merged the
 * way `mergeFeatureLocales` merges them at runtime. English is the source
 * locale, and `check-i18n` holds the others to its key set.
 */
import type core from './locales/en.json';
import type authCopy from '#features/auth/locales/en.json';
import type barcodeCopy from '#features/barcode/locales/en.json';
import type catalogCopy from '#features/catalog/locales/en.json';
import type devtoolsCopy from '#features/devtools/locales/en.json';
import type homeCopy from '#features/home/locales/en.json';
import type mealPlanCopy from '#features/mealPlan/locales/en.json';
import type notificationsCopy from '#features/notifications/locales/en.json';
import type onboardingCopy from '#features/onboarding/locales/en.json';
import type pantryCopy from '#features/pantry/locales/en.json';
import type profileCopy from '#features/profile/locales/en.json';
import type recipesCopy from '#features/recipes/locales/en.json';
import type shoppingListCopy from '#features/shoppingList/locales/en.json';

export type TranslationResources = typeof core &
  typeof authCopy &
  typeof barcodeCopy &
  typeof catalogCopy &
  typeof devtoolsCopy &
  typeof homeCopy &
  typeof mealPlanCopy &
  typeof notificationsCopy &
  typeof onboardingCopy &
  typeof pantryCopy &
  typeof profileCopy &
  typeof recipesCopy &
  typeof shoppingListCopy;
