import { useQuery } from '@apollo/client/react';
import { GetUserProfileDocument } from '#operations/auth/user.generated';
import { useIsLoggingOut } from '#store/useAppStore';
import { useUser } from '#store/useAppStore';

export const useProfileData = () => {
  const user = useUser();
  const isLoggingOut = useIsLoggingOut();

  // Inherits the client-wide `cache-and-network` -> `cache-first` pair
  // (`src/apollo/defaultOptions.ts`). Note what that does NOT mean: the
  // `nextFetchPolicy` switch lives on the ObservableQuery, and `useQuery`
  // builds a new one on every mount, so EVERY mount starts a fresh network
  // leg and reports `loading: true` for its whole duration — cached data or
  // not. `notifyOnNetworkStatusChange` only filters emissions AFTER the
  // initial result, so it does not change that either.
  //
  // Consumers must therefore gate on `!profile`, never on `loading` alone.
  // And because `returnPartialData` is false, `profile` is null whenever the
  // cache read is INCOMPLETE — one missing field of the selection is enough,
  // which is why every writer of the current user's profile has to write the
  // full shape (`__tests__/apollo/userProfileCompleteness.test.ts`).
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
