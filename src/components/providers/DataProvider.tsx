import React from 'react';
import { useDataPreloading } from '#/hooks/useDataPreloading';
import { useAllPendingInvites } from '#/hooks/invitations';
import { useAuth } from '#/hooks/auth/useAuth';

interface DataProviderProps {
  children: React.ReactNode;
}

/**
 * DataProvider - Preloads essential reference data for offline access
 *
 * This component wraps the app to preload reference data (units, etc.)
 * into the cache when the user is authenticated. This ensures:
 * - Zero loading states when adding shopping list items
 * - Full offline functionality for shopping lists
 * - Data is cached and available across app restarts
 *
 * Additionally, this component fetches ALL pending invitations (home + shopping list)
 * on app startup to ensure users don't miss invitations even if they didn't receive
 * the real-time notification. All invitations appear in the notification center.
 *
 * The preloading hook runs silently in the background and only activates
 * when the user is authenticated. It leverages Apollo cache persistence
 * to maintain data across sessions.
 *
 * This component should be placed inside ApolloProvider but before
 * the main navigation to ensure data is loaded early in the app lifecycle.
 */
export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const { user } = useAuth();

  // Preload units and other reference data when authenticated
  // The hook handles authentication checking internally
  useDataPreloading();

  // Fetch and display ALL pending invitations (home + shopping list) on startup
  // This ensures users can accept invitations even if they missed the notification
  useAllPendingInvites(user?.id);

  // Return children immediately - preloading happens in background
  return <>{children}</>;
};

export default DataProvider;
