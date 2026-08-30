import { useQuery } from '@apollo/client/react';
import { GetUserProfileDocument } from '#operations/auth/user.generated';
import { useIsLoggingOut } from '#store/useAppStore';
import { useUser } from '#store/useAppStore';

export const useProfileData = () => {
  const user = useUser();
  const isLoggingOut = useIsLoggingOut();

  // `nextFetchPolicy` lives on the ObservableQuery, which `useQuery` rebuilds
  // per mount, so EVERY mount runs a network leg and reports `loading: true`
  // throughout. Gate on `!profile`, never `loading` alone — and with
  // `returnPartialData` false, `profile` is null whenever the cache read is
  // INCOMPLETE, which is why every writer must write the full shape
  // (`__tests__/apollo/userProfileCompleteness.test.ts`).
  const { data, loading, error, refetch } = useQuery(GetUserProfileDocument, {
    skip: !user || isLoggingOut, // Skip query if logging out
    notifyOnNetworkStatusChange: false,
  });

  const profile = data?.me?.profile || null;

  return {
    user,
    profile,
    loading,
    // errorPolicy:'all' (global) resolves failures with data+error rather than
    // throwing — expose `error` so consumers can surface a refresh failure.
    error,
    refetch,
  };
};
