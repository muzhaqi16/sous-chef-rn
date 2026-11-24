import type { useShoppingListDetails } from '#features/shoppingList/hooks/useShoppingListDetails';

/** The list a settings section reads, as the details query holds it. */
export type SettingsList = ReturnType<
  typeof useShoppingListDetails
>['shoppingList'];
