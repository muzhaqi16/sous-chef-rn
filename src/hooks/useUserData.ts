import {useEffect} from 'react';
import {useGetCurrentUserQuery} from '../graphql/generated';
import {useStore} from '../store';

/**
 * Hook to manage user data - loads complete user data when needed
 * @param loadComplete - Whether to load complete user data immediately
 * @returns User data and loading state
 */
export const useUserData = (loadComplete = false) => {
  const {user, hasCompleteUserData, setCompleteUser, isAuthenticated} =
    useStore();

  // Only fetch complete user data if authenticated and requested
  const shouldFetch = isAuthenticated && loadComplete && !hasCompleteUserData();

  const {data, loading, error, refetch} = useGetCurrentUserQuery({
    skip: !shouldFetch,
    fetchPolicy: 'cache-first', // Use cache if available
    errorPolicy: 'all',
  });

  // Update store when complete user data is loaded
  useEffect(() => {
    if (data?.me && !hasCompleteUserData()) {
      setCompleteUser(data.me);
    }
  }, [data, hasCompleteUserData, setCompleteUser]);

  return {
    user,
    loading,
    error,
    refetch,
    hasCompleteData: hasCompleteUserData(),
    isAuthenticated,
  };
};
