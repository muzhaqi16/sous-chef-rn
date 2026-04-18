import { createContext, useContext } from 'react';

interface PurchaseHistoryContextValue {
  totalCount: number;
}

const PurchaseHistoryContext =
  createContext<PurchaseHistoryContextValue | null>(null);
export const PurchaseHistoryProvider = PurchaseHistoryContext.Provider;

export const usePurchaseHistoryContext = (): PurchaseHistoryContextValue => {
  const ctx = useContext(PurchaseHistoryContext);
  if (!ctx)
    throw new Error(
      'usePurchaseHistoryContext must be used within PurchaseHistoryProvider',
    );
  return ctx;
};
