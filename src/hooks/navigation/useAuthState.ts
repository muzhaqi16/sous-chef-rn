import {useStore} from '#store';

export const useAuthState = () => {
  const {user, isHydrated} = useStore();

  return {
    isUnauthenticated: isHydrated && !user,
    needsVerification: isHydrated && !!user && !user.emailVerified,
    needsOnboarding: isHydrated && !!user && user.emailVerified && !user.onBoarded,
    isFullyAuthenticated: isHydrated && !!user && user.emailVerified && user.onBoarded === true,

    // Raw values for convenience
    user,
    isHydrated,
  };
};
