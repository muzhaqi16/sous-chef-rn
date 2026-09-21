import { object, string } from 'yup';
import { normalizeSmartPunctuation } from '#utils/validation/common';
import { t, type KeyUnder } from '#/i18n';

/**
 * Schemas are built once at module scope, so a message resolved eagerly would
 * freeze whichever language was active at import time. Yup accepts a function
 * and calls it when the rule fails, so the lookup lands after any language
 * change. Same pattern as `features/catalog/utils/itemValidation.ts`.
 */
const msg =
  (key: KeyUnder<'onboardingValidation'>, options?: Record<string, unknown>) =>
  (): string =>
    t(`onboardingValidation.${key}`, options);

// home name rule
const homeNameRule = string()
  .required(msg('homeRequired'))
  .transform(normalizeSmartPunctuation)
  .min(2, msg('homeMin', { count: 2 }))
  .max(50, msg('homeMax', { count: 50 }))
  .matches(/^[a-zA-Z0-9\s'"-]+$/, msg('homeChars'))
  .trim();

// pantry name rule
const pantryNameRule = string()
  .required(msg('pantryRequired'))
  .transform(normalizeSmartPunctuation)
  .min(2, msg('pantryMin', { count: 2 }))
  .max(50, msg('pantryMax', { count: 50 }))
  .trim();

// shopping list name rule
const shoppingListNameRule = string()
  .required(msg('listRequired'))
  .transform(normalizeSmartPunctuation)
  .min(2, msg('listMin', { count: 2 }))
  .max(50, msg('listMax', { count: 50 }))
  .trim();

// ----------------------------------------------------------------------------

export const getCreateHomeSchema = (needsHome: boolean = true) => {
  return object<{ homeName: string; pantryName: string }>().shape({
    homeName: needsHome ? homeNameRule : string().notRequired(),
    pantryName: pantryNameRule,
  });
};

// ----------------------------------------------------------------------------

// create shopping list schema
export const createShoppingListSchema = object({
  shoppingListName: shoppingListNameRule,
});
