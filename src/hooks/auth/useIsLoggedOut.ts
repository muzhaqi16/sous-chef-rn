import { useAppStore, useUser } from '#store/useAppStore';
import { holdsSessionTokens } from '#store/slices/authSlice';

export const useIsLoggedOut = () => {
  const user = useUser();
  const holdsTokens = useAppStore(holdsSessionTokens);
  return !user && !holdsTokens;
};
