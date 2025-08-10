import {useUserProfileQuery} from '#generated';
import {useUserData} from '../useUserData';

export const useProfileData = () => {
  const {user} = useUserData(true);
  const {data, loading} = useUserProfileQuery({
    fetchPolicy: 'cache-and-network',
  });

  const profile = data?.userProfile || null;

  return {
    user,
    profile,
    loading,
  };
};
