import {useGetUserProfileQuery} from '#generated';
import {useUserData} from '../useUserData';
import {useStore} from '#store';

export const useProfileData = () => {
  const {user} = useUserData(true);
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
