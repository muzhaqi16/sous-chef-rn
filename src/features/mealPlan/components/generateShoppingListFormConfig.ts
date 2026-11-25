import { boolean, mixed, object, string, type ObjectSchema } from 'yup';
import { lazyMessage } from '#utils/validation/common';

type Destination = 'new' | 'existing';

export interface GenerateShoppingListFormValues {
  checkPantry: boolean;
  mode: Destination;
  /** A new list's name; blank takes the plan's. */
  name: string;
  /** Null until a list is picked; needed only for an existing list. */
  shoppingListId: string | null;
}

export const generateShoppingListDefaults: GenerateShoppingListFormValues = {
  checkPantry: true,
  mode: 'new',
  name: '',
  shoppingListId: null,
};

export const generateShoppingListSchema: ObjectSchema<GenerateShoppingListFormValues> =
  object({
    checkPantry: boolean().defined(),
    mode: mixed<Destination>().oneOf(['new', 'existing']).defined(),
    name: string().trim().defined(),
    shoppingListId: string()
      .nullable()
      .defined()
      .when('mode', {
        is: 'existing',
        then: schema =>
          schema.required(lazyMessage('generateShoppingList.selectListLabel')),
      }),
  });
