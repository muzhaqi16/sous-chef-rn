import type { TypePolicies } from '@apollo/client';
import type { AnswerNote } from '#/apollo/links/answerNotesLink';
import { noteCatalogAnswer } from './recipes/cache/catalogAnswerNote';
import { pantryTypePolicies } from './pantry/cache/typePolicies';
import { shoppingListTypePolicies } from './shoppingList/cache/typePolicies';
import { recipesTypePolicies } from './recipes/cache/typePolicies';
import { mealPlanTypePolicies } from './mealPlan/cache/typePolicies';
import { catalogTypePolicies } from './catalog/cache/typePolicies';
import { profileTypePolicies } from './profile/cache/typePolicies';
import { homeTypePolicies } from './home/cache/typePolicies';

/**
 * Every feature's cache shape. Its own list, not a manifest field: i18n
 * iterates the static registry on the LAUNCH PATH, and policies on a manifest
 * drag `cacheFieldPolicies` → the queue store → the Zustand store →
 * `apollo/client` into i18n init. `launchPathWeight.test.ts` holds that line.
 */
/** What a feature records from a read the server answered, beside its cache shape. */
export const FEATURE_ANSWER_NOTES: readonly AnswerNote[] = [noteCatalogAnswer];

export const FEATURE_TYPE_POLICIES: TypePolicies[] = [
  pantryTypePolicies,
  shoppingListTypePolicies,
  recipesTypePolicies,
  mealPlanTypePolicies,
  catalogTypePolicies,
  profileTypePolicies,
  homeTypePolicies,
];
