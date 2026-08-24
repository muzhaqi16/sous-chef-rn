import React, { useEffect } from 'react';
import { useDataPreloading } from '#/hooks/useDataPreloading';
import { useOfflineTabPreloading } from '#/hooks/useOfflineTabPreloading';
import { useNotificationsOnLaunch } from '#features/notifications/hooks/useNotificationsOnLaunch';
import { useIsLoggingOut, useUpdateUser, useUser } from '#store/useAppStore';
import { useQuery } from '@apollo/client/react';
import { GetUserProfileDocument } from '#operations/auth/user.generated';

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
  const user = useUser();
  const isLoggingOut = useIsLoggingOut();
  const updateUser = useUpdateUser();

  // Preload units and other reference data when authenticated
  // The hook handles authentication checking internally
  useDataPreloading();

  // Warm the sibling tabs' first-screen queries so a tab the user has not
  // opened is still usable offline. `lazy: true` keeps them unmounted; only
  // their data is fetched, on the idle queue.
  useOfflineTabPreloading();

  // Load all unread notifications on startup via notificationsConnection
  // Re-queries on foreground to catch missed events (reconnect proxy)
  useNotificationsOnLaunch(user?.id);

  // Fetch profile on every app load to keep Zustand store in sync
  // (e.g., profilePicture is only set at login/register and goes stale).
  // First mount fires the network once; subsequent re-renders read cache only.
  const { data: profileData } = useQuery(GetUserProfileDocument, {
    skip: !user || isLoggingOut,
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
