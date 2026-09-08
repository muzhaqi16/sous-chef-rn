import React, { createContext, useContext, type ReactNode } from 'react';
import type { ShoppingListPermissions } from '#features/shoppingList/hooks/useShoppingListPermissions';

/**
 * What this user may do to the open list, read where a control is built rather
 * than passed to it. `ListTemplate` sits between the two and takes its extra
 * props as `Record<string, unknown>`, so a prop-drilled answer arrives five
 * layers down as `boolean | undefined` — and each layer must then decide.
 */
const PermissionsContext = createContext<ShoppingListPermissions | null>(null);
PermissionsContext.displayName = 'ShoppingListPermissionsProvider';

interface ProviderProps {
  children: ReactNode;
  permissions: ShoppingListPermissions;
}

export const ShoppingListPermissionsProvider: React.FC<ProviderProps> = ({
  children,
  permissions,
}) => (
  <PermissionsContext.Provider value={permissions}>
    {children}
  </PermissionsContext.Provider>
);

/** Throws outside the provider: a surface out of reach of the answer stops. */
export function useShoppingListItemPermissions(): ShoppingListPermissions {
  const permissions = useContext(PermissionsContext);
  if (!permissions) {
    throw new Error(
      'useShoppingListItemPermissions must be used within ShoppingListPermissionsProvider',
    );
  }
  return permissions;
}
