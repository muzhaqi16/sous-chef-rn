import * as yup from 'yup';
import {emailRule} from './common';

// home name rule
const homeNameRule = yup
  .string()
  .required('Home name is required')
  .min(2, 'Home name must be at least 2 characters')
  .max(50, 'Home name must be less than 50 characters')
  .matches(
    /^[a-zA-Z0-9\s'-]+$/,
    'Home name can only contain letters, numbers, spaces, hyphens, and apostrophes',
  )
  .trim();

// pantry name rule
const pantryNameRule = yup
  .string()
  .required('Pantry name is required')
  .min(2, 'Pantry name must be at least 2 characters')
  .max(50, 'Pantry name must be less than 50 characters')
  .trim();

// shopping list name rule
const shoppingListNameRule = yup
  .string()
  .required('Shopping list name is required')
  .min(2, 'Shopping list name must be at least 2 characters')
  .max(50, 'Shopping list name must be less than 50 characters')
  .trim();

// member invitation email rule (reuses emailRule)
const inviteEmailRule = emailRule.lowercase().trim();

// ----------------------------------------------------------------------------

export const getCreateHomeSchema = (needsHome: boolean = true) => {
  return yup.object<{homeName: string; pantryName: string}>().shape({
    homeName: needsHome ? homeNameRule : yup.string().notRequired(),
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
export const createShoppingListSchema = yup.object({
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
export const inviteMembersSchema = yup.object({
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
export const selectPantryItemsSchema = yup.object({
  selectedItems: yup
    .array()
    .of(yup.string())
    .max(5, 'You can select up to 5 items'),
});

export const getSelectPantryItemsSchema = () => selectPantryItemsSchema;
