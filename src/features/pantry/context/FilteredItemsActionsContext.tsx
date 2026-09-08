import { createActionsContext } from '#hooks/utils/createActionsContext';

export interface FilteredItemsActions {
  navigateTo: (params: { itemId: string }) => void;
  // `itemId` is the CATALOG item's, which the mutation resolves; `display`
  // carries what the optimistic shopping-list row renders before it lands.
  handleAddToList?: (
    itemId: string,
    display: { itemName: string; unitId?: string },
  ) => void;
}

const context = createActionsContext<FilteredItemsActions>(
  'FilteredItemsActionsProvider',
);

export const FilteredItemsActionsProvider = context.Provider;
export const useFilteredItemsActions = context.useActions;
