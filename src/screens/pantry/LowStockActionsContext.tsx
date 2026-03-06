import React, { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

export interface LowStockActions {
  navigateTo: (params: { itemId: string }) => void;
  handleAddToList: (itemId: string) => void;
}

const LowStockActionsContext = createContext<LowStockActions | null>(null);

export const LowStockActionsProvider: React.FC<{ children: ReactNode; actions: LowStockActions }> = ({
  children, actions,
}) => {
  const actionsRef = useRef(actions);
  useEffect(() => { actionsRef.current = actions; });

  const stableActions: LowStockActions = {
    navigateTo: (params) => actionsRef.current.navigateTo(params),
    handleAddToList: (itemId) => actionsRef.current.handleAddToList(itemId),
  };

  return (
    <LowStockActionsContext.Provider value={stableActions}>
      {children}
    </LowStockActionsContext.Provider>
  );
};

export const useLowStockActions = (): LowStockActions => {
  const context = useContext(LowStockActionsContext);
  if (!context) throw new Error('useLowStockActions must be used within LowStockActionsProvider');
  return context;
};
