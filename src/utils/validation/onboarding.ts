import { object, string, array } from 'yup';
import { emailRule, normalizeSmartPunctuation } from './common';
import { getI18n } from '#/i18n/config';

/**
 * Schemas are built once at module scope, so a message resolved eagerly would
 * freeze whichever language was active at import time. Yup accepts a function
 * and calls it when the rule fails, so the lookup lands after any language
 * change. Same pattern as `validation/item.ts`.
 */
const msg = (key: string, options?: Record<string, unknown>) => (): string =>
  getI18n().t(`onboardingValidation.${key}`, options);

// home name rule
const homeNameRule = string()
  .required(msg('homeRequired'))
  .transform(normalizeSmartPunctuation)
  .min(2, msg('homeMin', { count: 2 }))
  .max(50, msg('homeMax', { count: 50 }))
  .matches(
    /^[a-zA-Z0-9\s'"-]+$/,
    'Home name can only contain letters, numbers, spaces, hyphens, apostrophes, and quotes',
  )
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

// member invitation email rule (reuses emailRule)
const inviteEmailRule = emailRule.lowercase().trim();

// ----------------------------------------------------------------------------

export const getCreateHomeSchema = (needsHome: boolean = true) => {
  return object<{ homeName: string; pantryName: string }>().shape({
    homeName: needsHome ? homeNameRule : string().notRequired(),
    pantryName: pantryNameRule,
  });
};

// usage in CreateHomeScreen:
// const needsHome = homes.length === 0;
// const { control, handleSubmit, formState } = useForm<FormValues>({
//   resolver: yupResolver(getCreateHomeSchema(needsHome)),
//   defaultValues: { homeName: '', pantryName: 'Kitchen Pantry' },
// })

// ----------------------------------------------------------------------------

// 7) create shopping list schema
export const createShoppingListSchema = object({
  shoppingListName: shoppingListNameRule,
});

export const getCreateShoppingListSchema = () => createShoppingListSchema;

// usage in CreateShoppingListScreen:
// const { control, handleSubmit, formState } = useForm<FormValues>({
//   resolver: yupResolver(getCreateShoppingListSchema()),
//   defaultValues: { shoppingListName: 'Weekly Groceries' },
// })

// ----------------------------------------------------------------------------

// 8) invite members schema
export const inviteMembersSchema = object({
  email: inviteEmailRule,
});

export const getInviteMembersSchema = () => inviteMembersSchema;

// usage in InviteMemberScreen (for individual email validation):
// const validateEmail = (email: string) => {
//   try {
//     inviteMembersSchema.validateSync({ email });
//     return true;
//   } catch {
//     return false;
//   }
// }

// ----------------------------------------------------------------------------

// 9) select pantry items schema (optional selection)
export const selectPantryItemsSchema = object({
  selectedItems: array()
    .of(string())
    .max(5, msg('itemsMax', { count: 5 })),
});

export const getSelectPantryItemsSchema = () => selectPantryItemsSchema;
