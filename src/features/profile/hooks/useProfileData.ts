import { useQuery } from '@apollo/client/react';
import { GetUserProfileDocument } from '#operations/auth/user.generated';
import { useIsLoggingOut } from '#store/useAppStore';
import { useUser } from '#store/useAppStore';

export const useProfileData = () => {
  const user = useUser();
  const isLoggingOut = useIsLoggingOut();

  // `nextFetchPolicy` lives on the ObservableQuery, which `useQuery` rebuilds
  // per mount, so EVERY mount runs a network leg and reports `loading: true`
  // throughout. Gate on `hasLoadedProfile`, never `loading` or `!profile`:
  // `profile` is null for an account with no row, and also whenever the cache
  // read is INCOMPLETE (`returnPartialData` false), which is why every writer
  // must write the full shape (`__tests__/apollo/userProfileCompleteness.test.ts`).
  const { data, loading, error, refetch } = useQuery(GetUserProfileDocument, {
    skip: !user || isLoggingOut, // Skip query if logging out
    notifyOnNetworkStatusChange: false,
  });

  const profile = data?.me?.profile ?? null;

  return {
    user,
    profile,
    // `me` answered. Its `profile` is null for an account that has none until
    // the first `updateProfile` creates it.
    hasLoadedProfile: !!data?.me,
    loading,
    // errorPolicy:'all' (global) resolves failures with data+error rather than
    // throwing.
    error,
    refetch,
  };
};
