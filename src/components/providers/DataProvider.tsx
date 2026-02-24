import React, { useEffect } from 'react';
import { useDataPreloading } from '#/hooks/useDataPreloading';
import { useAllPendingInvites } from '#/hooks/invitations/useAllPendingInvites';
import { useAuth } from '#/hooks/auth/useAuth';
import { useGetUserProfileQuery } from '#/graphql/generated';
import { useAppStore } from '#store/useAppStore';

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
  const isLoggingOut = useAppStore(state => state.isLoggingOut);
  const updateUser = useAppStore(state => state.updateUser);
  const hasName = !!(user?.name || user?.firstName);

  // Preload units and other reference data when authenticated
  // The hook handles authentication checking internally
  useDataPreloading();

  // Fetch and display ALL pending invitations (home + shopping list) on startup
  // This ensures users can accept invitations even if they missed the notification
  useAllPendingInvites(user?.id);

  // Fallback: fetch profile only when name is missing from auth store
  // (e.g., profile was updated externally, or migration didn't cover an edge case).
  // skip: hasName means this does NOT fire on normal cold starts where the
  // migration already populated the fields — it only fires as a safety net.
  const { data: profileData } = useGetUserProfileQuery({
    fetchPolicy: 'cache-first',
    nextFetchPolicy: 'cache-and-network',
    skip: !user || isLoggingOut || hasName,
    notifyOnNetworkStatusChange: false,
  });

  useEffect(() => {
    const profile = profileData?.me?.profile;
    if (profile) {
      updateUser({
        firstName: profile.firstName ?? undefined,
        lastName: profile.lastName ?? undefined,
        name: profile.displayName ?? undefined,
        profilePicture: profile.avatar ?? undefined,
      });
    }
  }, [profileData, updateUser]);

  // Return children immediately - preloading happens in background
  return <>{children}</>;
};

export default DataProvider;
