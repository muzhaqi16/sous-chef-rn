import { object, string, type ObjectSchema } from 'yup';
import { lazyMessage } from '#/utils/validation/common';
import { isBudgetInput } from '#features/shoppingList/screens/useListBudget';

export interface ListPriceSettingsValues {
  budget: string;
  store: string;
}

export const listPriceSettingsSchema: ObjectSchema<ListPriceSettingsValues> =
  object({
    budget: string()
      .defined()
      .test(
        'budget',
        lazyMessage('shoppingListScreens.budget.invalid'),
        isBudgetInput,
      ),
    store: string().defined(),
  });
