import {useGetUserProfileQuery} from '#generated';
import {useStore} from '#store';
import {useAuth} from '#hooks';

export const useProfileData = () => {
  const {user} = useAuth();
  const isLoggingOut = useStore(state => state.isLoggingOut);

  const {data, loading} = useGetUserProfileQuery({
    fetchPolicy: 'cache-and-network',
    skip: !user || isLoggingOut, // Skip query if logging out
  });

  const profile = data?.userProfile || null;

  return {
    user,
    profile,
    loading,
  };
};
