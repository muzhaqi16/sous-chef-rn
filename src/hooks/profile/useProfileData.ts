import {useGetUserProfileQuery} from '#generated';
import {useAppStore} from '#store/useAppStore';
import {useAuth} from '#hooks/auth/useAuth';

export const useProfileData = () => {
  const {user} = useAuth();
  const isLoggingOut = useAppStore(state => state.isLoggingOut);

  const {data, loading} = useGetUserProfileQuery({
    // ✅ OPTIMIZED: Use cache-first for instant loading
    // First load shows cached data immediately, then updates in background if needed
    fetchPolicy: 'cache-first',
    // For subsequent fetches, use cache-and-network to keep data fresh
    nextFetchPolicy: 'cache-and-network',
    skip: !user || isLoggingOut, // Skip query if logging out
    // Don't trigger loading state during background refresh
    notifyOnNetworkStatusChange: false,
  });

  const profile = data?.userProfile || null;

  return {
    user,
    profile,
    loading,
  };
};
