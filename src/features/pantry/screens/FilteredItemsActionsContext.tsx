import { createActionsContext } from '#hooks/utils/createActionsContext';

export interface FilteredItemsActions {
  navigateTo: (params: { itemId: string }) => void;
  // `display` carries the fields needed to write the optimistic shopping-list
  // item (the row only has these; the catalog item id isn't in the minimal shape).
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
