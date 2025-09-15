import {useStore} from '#store';

export const useAuthState = {
  isUnauthenticated: () => {
    const {user, isHydrated} = useStore();
    return isHydrated && !user;
  },

  needsVerification: () => {
    const {user, isHydrated} = useStore();
    return isHydrated && !!user && !user.emailVerified;
  },

  needsOnboarding: () => {
    const {user, isHydrated} = useStore();
    return isHydrated && !!user && user.emailVerified && !user.onBoarded;
  },

  isFullyAuthenticated: () => {
    const {user, isHydrated} = useStore();
    return (
      isHydrated && !!user && user.emailVerified && user.onBoarded === true
    );
  },
};
