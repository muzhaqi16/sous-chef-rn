import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';

export interface FilteredItemsActions {
  navigateTo: (params: { itemId: string }) => void;
  handleAddToList?: (itemId: string) => void;
}

const FilteredItemsActionsContext = createContext<FilteredItemsActions | null>(
  null,
);

export const FilteredItemsActionsProvider: React.FC<{
  children: ReactNode;
  actions: FilteredItemsActions;
}> = ({ children, actions }) => {
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });

  const stableActions: FilteredItemsActions = {
    navigateTo: params => actionsRef.current.navigateTo(params),
    handleAddToList: itemId => actionsRef.current.handleAddToList?.(itemId),
  };

  return (
    <FilteredItemsActionsContext.Provider value={stableActions}>
      {children}
    </FilteredItemsActionsContext.Provider>
  );
};

export const useFilteredItemsActions = (): FilteredItemsActions => {
  const context = useContext(FilteredItemsActionsContext);
  if (!context)
    throw new Error(
      'useFilteredItemsActions must be used within FilteredItemsActionsProvider',
    );
  return context;
};
