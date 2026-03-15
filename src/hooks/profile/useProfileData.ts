import { useGetUserProfileQuery } from '#generated';
import { useAppStore } from '#store/useAppStore';
import { useAuthUser } from '#hooks/auth/useAuthUser';

export const useProfileData = () => {
  const user = useAuthUser();
  const isLoggingOut = useAppStore(state => state.isLoggingOut);

  const { data, loading, refetch } = useGetUserProfileQuery({
    // ✅ OPTIMIZED: Use cache-first for instant loading
    // First load shows cached data immediately, then updates in background if needed
    fetchPolicy: 'cache-first',
    // For subsequent fetches, use cache-and-network to keep data fresh
    nextFetchPolicy: 'cache-and-network',
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
