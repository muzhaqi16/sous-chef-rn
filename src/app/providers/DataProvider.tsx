import React, { useEffect } from 'react';
import { useDataPreloading } from '#/hooks/useDataPreloading';
import { useOfflineTabPreloading } from '#/app/useOfflineTabPreloading';
import { useNotificationsOnLaunch } from '#features/notifications/hooks/useNotificationsOnLaunch';
import { useIsLoggingOut, useUpdateUser, useUser } from '#store/useAppStore';
import { useQuery } from '@apollo/client/react';
import { GetUserProfileDocument } from '#operations/auth/user.generated';

interface DataProviderProps {
  children: React.ReactNode;
}

/**
 * Warms reference data (units, …) and pending invitations into the cache once
 * authenticated, so adding an item has no loading state and works offline.
 * Must sit inside `ApolloProvider` but ABOVE navigation, or the warm-up starts
 * after the screens that need it.
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
