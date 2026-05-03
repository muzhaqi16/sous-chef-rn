import { useQuery } from '@apollo/client/react';
import { GetUserProfileDocument } from '#operations/auth/user.generated';
import { useAppStore } from '#store/useAppStore';
import { useUser } from '#store/useAppStore';

export const useProfileData = () => {
  const user = useUser();
  const isLoggingOut = useAppStore(state => state.isLoggingOut);

  const { data, loading, refetch } = useQuery(GetUserProfileDocument, {
    // First mount: read cache + fire one network request to refresh.
    // Subsequent re-renders: serve from cache only (no network thrash).
    // Per CLAUDE.md cache persistence convention.
    skip: !user || isLoggingOut, // Skip query if logging out
    // Don't trigger loading state during background refresh
    notifyOnNetworkStatusChange: false,
  });

  const profile = data?.me?.profile || null;

  return {
    user,
    profile,
    loading,
    refetch,
  };
};
